import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronDown, FolderPlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { DraggableRow } from "@/components/DraggableRow";
import { EmptyState } from "@/components/EmptyState";
import { FileRow } from "@/components/FileRow";
import { FolderRow } from "@/components/FolderRow";
import { SearchBar } from "@/components/SearchBar";
import { SortableRow } from "@/components/SortableRow";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileEntry, Folder, SortDirection, SortField } from "@/types";

const SORT_KEYS: Record<SortField, string> = {
  custom: "sort.custom",
  name: "sort.name",
  lastModified: "sort.lastModified",
  created: "sort.created",
  size: "sort.size",
};

interface FileListProps {
  folders: Folder[];
  files: FileEntry[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  sortField: SortField;
  sortDir: SortDirection;
  onSortChange: (field: SortField, dir: SortDirection) => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  isDragActive: boolean;
  dropTarget: { type: "file" | "folder"; id: string } | null;
  onOpen: (file: FileEntry) => void;
  onDownload: (file: FileEntry) => void;
  onUploadNewVersion: (file: FileEntry) => void;
  onViewHistory: (file: FileEntry) => void;
  onShowWhatsNew: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onOpenFolder: (folder: Folder) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onReorderFiles: (orderedIds: string[]) => void;
  onMoveFile: (fileId: string, targetFolderId: string) => void;
  onMoveFolder: (folderId: string, targetFolderId: string) => void;
  /** Fires around the whole lifetime of an in-app drag - see ProjectView's inAppDragActiveRef. */
  onDragStateChange: (active: boolean) => void;
}

export function FileList({
  folders,
  files,
  loading,
  search,
  onSearchChange,
  sortField,
  sortDir,
  onSortChange,
  onUploadClick,
  onNewFolderClick,
  isDragActive,
  dropTarget,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderFiles,
  onMoveFile,
  onMoveFolder,
  onDragStateChange,
  ...rowActions
}: FileListProps) {
  const { t } = useLanguage();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const isEmpty = folders.length === 0 && files.length === 0;
  const reorderable = search === "";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Local mirror so a file drag reorders instantly instead of waiting for
  // the reorder call + refetch to round-trip back through props. Folders no
  // longer reorder against each other by drag (see DraggableRow) so they
  // don't need one - the `folders` prop is rendered directly.
  const [fileOrder, setFileOrder] = useState(files);
  useEffect(() => setFileOrder(files), [files]);

  // The folder currently acting as a drop target mid-drag - drives its
  // highlight. Unlike files (which stay siblings and can only reorder),
  // dropping anything onto a folder unconditionally means "move into it,"
  // so this needs no position math, just "is a folder being hovered."
  const [moveIntoFolderId, setMoveIntoFolderId] = useState<string | null>(null);

  function handleDragStart() {
    onDragStateChange(true);
    // Text selection can otherwise survive into the drag on some engines and
    // visually look like the app is "selecting files" instead of dragging.
    window.getSelection()?.removeAllRanges();
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setMoveIntoFolderId(null);
      return;
    }
    const overIsFolder = folders.some((f) => f.id === over.id);
    setMoveIntoFolderId(overIsFolder ? (over.id as string) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    onDragStateChange(false);
    setMoveIntoFolderId(null);
    if (!over || active.id === over.id) return;

    const activeIsFolder = folders.some((f) => f.id === active.id);
    const overIsFolder = folders.some((f) => f.id === over.id);

    if (overIsFolder) {
      if (activeIsFolder) {
        onMoveFolder(active.id as string, over.id as string);
      } else {
        onMoveFile(active.id as string, over.id as string);
      }
      return;
    }

    if (activeIsFolder) return; // a folder dragged over a file has no defined effect

    const fileFrom = fileOrder.findIndex((f) => f.id === active.id);
    const fileTo = fileOrder.findIndex((f) => f.id === over.id);
    if (fileFrom === -1 || fileTo === -1) return;
    const next = arrayMove(fileOrder, fileFrom, fileTo);
    setFileOrder(next);
    if (sortField !== "custom") onSortChange("custom", "asc");
    onReorderFiles(next.map((f) => f.id));
  }

  function handleDragCancel() {
    onDragStateChange(false);
    setMoveIntoFolderId(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-3 pt-4">
        <div className="min-w-[100px] max-w-xs flex-1 basis-40">
          <SearchBar ref={searchRef} value={search} onChange={onSearchChange} placeholder={t("files.searchPlaceholder")} />
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setSortMenuOpen((v) => !v)}
            className="no-drag flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            {sortDir === "asc" ? <ArrowUpWideNarrow size={13} /> : <ArrowDownWideNarrow size={13} />}
            <span className="whitespace-nowrap">{t(SORT_KEYS[sortField])}</span>
            <ChevronDown size={13} className="shrink-0 text-label-tertiary" />
          </button>
          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} />
              <div className="animate-scale-in absolute left-0 top-9 z-40 w-44 rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple">
                {(Object.keys(SORT_KEYS) as SortField[]).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      const alreadyActive = field === sortField;
                      // "Custom Order" has no inherent asc/desc meaning - default
                      // it to ascending (top-to-bottom drag order) on first pick
                      // instead of the "desc first" convention the other fields use.
                      const nextDir = alreadyActive
                        ? sortDir === "desc"
                          ? "asc"
                          : "desc"
                        : field === "custom"
                          ? "asc"
                          : "desc";
                      onSortChange(field, nextDir);
                      setSortMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-accent hover:text-white ${
                      field === sortField ? "text-accent" : "text-label-primary"
                    }`}
                  >
                    {t(SORT_KEYS[field])}
                    {field === sortField && (sortDir === "asc" ? <ArrowUpWideNarrow size={12} /> : <ArrowDownWideNarrow size={12} />)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-w-2 flex-1" />

        <Button variant="secondary" className="shrink-0" onClick={onNewFolderClick}>
          <FolderPlus size={14} />
          {t("files.newFolder")}
        </Button>
        <Button variant="primary" className="shrink-0" onClick={onUploadClick}>
          <Upload size={14} />
          {t("files.uploadFile")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {loading && <p className="px-2 py-4 text-[12.5px] text-label-secondary">{t("files.loading")}</p>}

        {!loading && isEmpty && search === "" && (
          <EmptyState
            title={t("files.emptyTitle")}
            description={t("files.emptyDescription")}
            action={
              <Button variant="primary" onClick={onUploadClick}>
                <Upload size={14} />
                {t("files.uploadFile")}
              </Button>
            }
          />
        )}

        {!loading && isEmpty && search !== "" && (
          <EmptyState
            title={t("files.noMatchTitle")}
            description={t("files.noMatchDescription", { search })}
          />
        )}

        {!loading && !isEmpty && reorderable && (
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="space-y-0.5">
              {folders.map((folder) => (
                <DraggableRow key={folder.id} id={folder.id}>
                  <FolderRow
                    folder={folder}
                    onOpen={onOpenFolder}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                    isDropTarget={(dropTarget?.type === "folder" && dropTarget.id === folder.id) || moveIntoFolderId === folder.id}
                  />
                </DraggableRow>
              ))}
              <SortableContext items={fileOrder.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fileOrder.map((file) => (
                  <SortableRow key={file.id} id={file.id}>
                    <FileRow
                      file={file}
                      isDropTarget={dropTarget?.type === "file" && dropTarget.id === file.id}
                      {...rowActions}
                    />
                  </SortableRow>
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}

        {!loading && !isEmpty && !reorderable && (
          <div className="pointer-events-auto space-y-0.5">
            {folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                onOpen={onOpenFolder}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                isDropTarget={dropTarget?.type === "folder" && dropTarget.id === folder.id}
              />
            ))}
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                isDropTarget={dropTarget?.type === "file" && dropTarget.id === file.id}
                {...rowActions}
              />
            ))}
          </div>
        )}
      </div>

      {isDragActive && !dropTarget && (
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center rounded-apple-lg border-2 border-dashed border-accent bg-accent/[0.06] backdrop-blur-sm">
          <Upload size={28} className="mb-2 text-accent" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-accent">{t("files.dropHere")}</p>
        </div>
      )}

      {isDragActive && dropTarget && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <p className="rounded-full border border-surface-border bg-surface-modal px-3 py-1.5 text-[12px] font-medium text-accent shadow-popover backdrop-blur-apple">
            {dropTarget.type === "file" ? t("files.dropNewVersion") : t("files.dropIntoFolder")}
          </p>
        </div>
      )}
    </div>
  );
}
