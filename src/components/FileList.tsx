import { ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronDown, FolderPlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FileRow } from "@/components/FileRow";
import { FolderRow } from "@/components/FolderRow";
import { SearchBar } from "@/components/SearchBar";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileEntry, Folder, SortDirection, SortField } from "@/types";

const SORT_KEYS: Record<SortField, string> = {
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
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onOpenFolder: (folder: Folder) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
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
  ...rowActions
}: FileListProps) {
  const { t } = useLanguage();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const isEmpty = folders.length === 0 && files.length === 0;

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
    <div className="relative flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-6 pb-3 pt-4">
        <div className="w-64">
          <SearchBar ref={searchRef} value={search} onChange={onSearchChange} placeholder={t("files.searchPlaceholder")} />
        </div>

        <div className="relative">
          <button
            onClick={() => setSortMenuOpen((v) => !v)}
            className="no-drag flex h-8 items-center gap-1.5 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            {sortDir === "asc" ? <ArrowUpWideNarrow size={13} /> : <ArrowDownWideNarrow size={13} />}
            {t(SORT_KEYS[sortField])}
            <ChevronDown size={13} className="text-label-tertiary" />
          </button>
          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} />
              <div className="animate-scale-in absolute left-0 top-9 z-40 w-44 rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple">
                {(Object.keys(SORT_KEYS) as SortField[]).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      onSortChange(field, field === sortField && sortDir === "desc" ? "asc" : "desc");
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

        <div className="flex-1" />

        <Button variant="secondary" onClick={onNewFolderClick}>
          <FolderPlus size={14} />
          {t("files.newFolder")}
        </Button>
        <Button variant="primary" onClick={onUploadClick}>
          <Upload size={14} />
          {t("files.uploadFile")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
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
          <EmptyState title={t("files.noMatchTitle")} description={t("files.noMatchDescription", { search })} />
        )}

        {!loading && !isEmpty && (
          <div className="space-y-0.5">
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

      {isDragActive && (
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center rounded-apple-lg border-2 border-dashed border-accent bg-accent/[0.06] backdrop-blur-sm">
          <Upload size={28} className="mb-2 text-accent" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-accent">
            {dropTarget?.type === "file"
              ? t("files.dropNewVersion")
              : dropTarget?.type === "folder"
                ? t("files.dropIntoFolder")
                : t("files.dropHere")}
          </p>
        </div>
      )}
    </div>
  );
}
