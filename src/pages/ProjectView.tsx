import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Breadcrumb, type BreadcrumbEntry } from "@/components/Breadcrumb";
import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { FileList } from "@/components/FileList";
import { NewFolderModal } from "@/components/NewFolderModal";
import { ProjectModal } from "@/components/ProjectModal";
import { RenameModal } from "@/components/RenameModal";
import { RestoreModal } from "@/components/RestoreModal";
import { UploadModal } from "@/components/UploadModal";
import { VersionHistory } from "@/components/VersionHistory";
import { VersionInfoModal } from "@/components/VersionInfoModal";
import { useFiles } from "@/hooks/useFiles";
import { useFolders } from "@/hooks/useFolders";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useVersions } from "@/hooks/useVersions";
import {
  ApiError,
  createFolder as apiCreateFolder,
  deleteFile as apiDeleteFile,
  deleteFolder as apiDeleteFolder,
  deleteProject as apiDeleteProject,
  deleteVersion as apiDeleteVersion,
  downloadVersion,
  importFolder,
  moveFile,
  moveFolder,
  openVersion,
  pathIsDirectory,
  pickFilesToUpload,
  renameFile as apiRenameFile,
  renameFolder as apiRenameFolder,
  reorderFiles,
  restoreVersion as apiRestoreVersion,
  updateProject,
  updateVersionDescription,
  uploadFile,
  uploadNewVersion,
} from "@/services/api";
import type { FileEntry, FileVersion, Folder, Project, SortDirection, SortField } from "@/types";

type UploadTarget =
  | { mode: "new-file"; sourcePath: string; folderId: string | null }
  | { mode: "new-version"; file: FileEntry; sourcePath: string; candidatePaths?: string[] };

type DropTarget = { type: "file" | "folder"; id: string } | null;

interface ProjectViewProps {
  project: Project;
  navResetSignal?: number;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: () => void;
}

// Rows sit `space-y-0.5` (2px) apart, and a real mouse/trackpad release
// lands in that gap - or right on a row's rounded-corner edge - often
// enough that a strict elementFromPoint hit-test would silently resolve to
// "no target" there, even though the row was highlighted as active a
// moment earlier. That made a drop right at a folder's edge fall back to
// the project root instead of that folder - looking like the highlight and
// the "add to project root" behavior were firing at once. This tolerance
// is deliberately smaller than half the inter-row gap so two rows' padded
// boxes can never both claim the same point; findNearestDropTarget also
// picks the closest candidate rather than the first match, so even a point
// that (due to rounding) falls inside more than one padded box resolves to
// the row it's actually nearest to.
const ROW_HIT_PADDING = 3;

function resolveDropTarget(logicalX: number, logicalY: number): DropTarget {
  const el = document.elementFromPoint(logicalX, logicalY);
  const direct = el?.closest("[data-drop-target]") as HTMLElement | null;
  const fromElement = direct ?? findNearestDropTarget(logicalX, logicalY);
  const type = fromElement?.dataset.dropTarget as "file" | "folder" | undefined;
  const id = fromElement?.dataset.rowId;
  if (!type || !id) return null;
  return { type, id };
}

function findNearestDropTarget(logicalX: number, logicalY: number): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("[data-drop-target][data-row-id]");
  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const dx = Math.max(rect.left - logicalX, 0, logicalX - rect.right);
    const dy = Math.max(rect.top - logicalY, 0, logicalY - rect.bottom);
    if (dx > ROW_HIT_PADDING || dy > ROW_HIT_PADDING) continue;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

export function ProjectView({ project, navResetSignal, onProjectUpdated, onProjectDeleted }: ProjectViewProps) {
  const { showToast } = useToast();
  const { t, translateError } = useLanguage();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: project.name }]);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastModified");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const { files, loading: filesLoading, refresh: refreshFiles } = useFiles(
    project.id,
    currentFolderId,
    search,
    sortField,
    sortDir,
  );
  const { folders, refresh: refreshFolders } = useFolders(project.id, currentFolderId);

  const [historyFileId, setHistoryFileId] = useState<string | null>(null);
  const { detail, loading: historyLoading, refresh: refreshHistory } = useVersions(historyFileId);

  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<FileVersion | null>(null);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<FileVersion | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [whatsNewTarget, setWhatsNewTarget] = useState<FileEntry | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dropTargetRef = useRef<DropTarget>(null);
  // The native drag position arrives in physical pixels; converting it with
  // the webview's own window.devicePixelRatio can silently disagree with the
  // OS's actual scale factor (a documented Tauri quirk, most visible on
  // macOS), landing elementFromPoint on the wrong row entirely - so track
  // the real scale factor Tauri reports instead and use PhysicalPosition's
  // own conversion.
  const scaleFactorRef = useRef(1);
  // dnd-kit's own in-app drag (reordering, or moving a file/folder into
  // another folder) is pointer-event based, but on macOS WebKit can still
  // interpret the same mouse gesture as a native content drag and fire
  // Tauri's OS-level onDragDropEvent alongside it - a real external OS drag
  // can never start while a mouse button is already down driving an in-app
  // drag, so any native drag event arriving while this is true is that
  // spurious echo, not a real drop, and must be ignored outright rather
  // than fed into the same isDragActive/dropTarget state.
  const inAppDragActiveRef = useRef(false);

  useEffect(() => {
    const win = getCurrentWindow();
    void win.scaleFactor().then((f) => {
      scaleFactorRef.current = f;
    });
    const unlisten = win.onScaleChanged(({ payload }) => {
      scaleFactorRef.current = payload.scaleFactor;
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    setCurrentFolderId(null);
    setBreadcrumb([{ id: null, name: project.name }]);
    setSearch("");
    // Re-run (even though project.id is unchanged) whenever the sidebar
    // entry for this project is clicked again, so it always jumps back to
    // the project root instead of staying wherever the user had navigated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, navResetSignal]);

  useEffect(() => {
    setBreadcrumb((prev) => (prev.length > 0 ? [{ ...prev[0], name: project.name }, ...prev.slice(1)] : prev));
  }, [project.name]);

  // Any modal other than Version History itself: while one of these is open,
  // a native OS drag-and-drop shouldn't pop open yet another (unrelated,
  // wrongly-targeted) upload modal on top of it - elementFromPoint would
  // otherwise hit the modal's backdrop, resolve to no drop target, and
  // silently start a brand new "upload as new file" flow, stacking without
  // limit if the user keeps dragging.
  const blockingModalOpen =
    uploadTarget !== null ||
    restoreTarget !== null ||
    deleteVersionTarget !== null ||
    deleteFileTarget !== null ||
    renameTarget !== null ||
    newFolderOpen ||
    renameFolderTarget !== null ||
    deleteFolderTarget !== null ||
    editProjectOpen ||
    deleteProjectOpen;

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (inAppDragActiveRef.current) return;
      if (event.payload.type === "over") {
        setIsDragActive(true);
        // Version History's backdrop covers the whole window, so
        // elementFromPoint can never see the file rows underneath it -
        // while it's open, any drop anywhere is for that file's next version.
        const logical = event.payload.position.toLogical(scaleFactorRef.current);
        setDragPosition({ x: logical.x, y: logical.y });
        const target = historyFileId
          ? ({ type: "file", id: historyFileId } as DropTarget)
          : resolveDropTarget(logical.x, logical.y);
        dropTargetRef.current = target;
        setDropTarget(target);
      } else if (event.payload.type === "leave") {
        setIsDragActive(false);
        setDragPosition(null);
        dropTargetRef.current = null;
        setDropTarget(null);
      } else if (event.payload.type === "drop") {
        setIsDragActive(false);
        setDragPosition(null);
        const target = dropTargetRef.current;
        dropTargetRef.current = null;
        setDropTarget(null);
        if (blockingModalOpen) return;
        void handleIncomingPaths(event.payload.paths, target);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, currentFolderId, files, detail, historyFileId, blockingModalOpen]);

  // Tauri's own "leave" event should cover the cursor exiting the window
  // mid-drag, but the OS can also just switch focus away entirely (alt-tab,
  // a system dialog stealing focus, the debugger detaching) without ever
  // delivering one - a safety net so a drag can never leave the highlight
  // state stuck on stale once the window itself is no longer front-most.
  useEffect(() => {
    function resetDragState() {
      setIsDragActive(false);
      setDragPosition(null);
      dropTargetRef.current = null;
      setDropTarget(null);
      // If an in-app drag was in progress when focus was lost, its own
      // dragend/cancel may never fire - without this, the native-event gate
      // above would stay stuck permanently ignoring every future real
      // Finder drag, since nothing would ever flip it back off.
      inAppDragActiveRef.current = false;
    }
    function onVisibilityChange() {
      if (document.hidden) resetDragState();
    }
    window.addEventListener("blur", resetDragState);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", resetDragState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  async function handleIncomingPaths(paths: string[], target: DropTarget) {
    if (paths.length === 0) return;

    if (target?.type === "file") {
      const targetFile = files.find((f) => f.id === target.id) ?? (detail?.id === target.id ? detail : null);
      if (targetFile) {
        setUploadTarget({
          mode: "new-version",
          file: targetFile,
          sourcePath: paths[0],
          candidatePaths: paths.length > 1 ? paths : undefined,
        });
        return;
      }
    }

    const folderId = target?.type === "folder" ? target.id : currentFolderId;

    // A dropped folder (from Finder/Explorer, not one of the app's own rows)
    // is classified up front so it can go through import_folder instead of
    // being treated as a file to copy - it becomes its own app folder, with
    // everything inside it (subfolders included) imported as version 1.
    const kinds = await Promise.all(paths.map((p) => pathIsDirectory(p).catch(() => false)));
    const directoryPaths = paths.filter((_, i) => kinds[i]);
    const filePaths = paths.filter((_, i) => !kinds[i]);

    let importedFolder: Folder | null = null;
    let folderImportErrors = 0;
    for (const dirPath of directoryPaths) {
      try {
        const result = await importFolder(project.id, folderId, dirPath);
        importedFolder = directoryPaths.length === 1 ? result.rootFolder : null;
      } catch (e) {
        folderImportErrors++;
        showToast({
          title: t("toast.folderImportError"),
          description: e instanceof ApiError ? translateError(e.message) : undefined,
          variant: "error",
        });
      }
    }

    if (filePaths.length === 1 && directoryPaths.length === 0) {
      setUploadTarget({ mode: "new-file", sourcePath: filePaths[0], folderId });
      return;
    }

    let succeeded = 0;
    for (const p of filePaths) {
      try {
        await uploadFile(project.id, folderId, p);
        succeeded++;
      } catch {
        // continue with the rest of the batch
      }
    }

    if (directoryPaths.length > 0 || filePaths.length > 0) {
      await Promise.all([refreshFiles(), refreshFolders()]);
    }
    if (succeeded > 0) {
      showToast({ title: t("toast.filesUploaded", { count: succeeded }) });
    }
    if (directoryPaths.length - folderImportErrors > 0) {
      showToast({ title: t("toast.folderImported", { count: directoryPaths.length - folderImportErrors }) });
    }
    if (importedFolder) {
      openFolder(importedFolder);
    }
  }

  async function handleUploadClick() {
    const paths = await pickFilesToUpload(true);
    await handleIncomingPaths(paths, null);
  }

  function openHistory(file: FileEntry) {
    setHistoryFileId(file.id);
  }

  function openFolder(folder: Folder) {
    setSearch("");
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  }

  function navigateBreadcrumb(id: string | null) {
    setSearch("");
    setBreadcrumb((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      return idx === -1 ? prev : prev.slice(0, idx + 1);
    });
    setCurrentFolderId(id);
  }

  async function handleOpenFile(file: FileEntry) {
    if (!file.currentVersion) return;
    try {
      await openVersion(file.currentVersion.id);
    } catch (e) {
      showToast({
        title: t("toast.openFileError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleOpenVersion(version: FileVersion) {
    try {
      await openVersion(version.id);
    } catch (e) {
      showToast({
        title: t("toast.openFileError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleDownloadFile(file: FileEntry) {
    if (!file.currentVersion) return;
    await handleDownloadVersion(file.currentVersion);
  }

  async function handleDownloadVersion(version: FileVersion) {
    try {
      const saved = await downloadVersion(version.id, version.originalFilename);
      if (saved) showToast({ title: t("toast.downloadComplete") });
    } catch (e) {
      showToast({
        title: t("toast.downloadFileError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleUploadNewVersionClick(file: FileEntry) {
    const paths = await pickFilesToUpload(false);
    if (paths.length === 0) return;
    setUploadTarget({ mode: "new-version", file, sourcePath: paths[0] });
  }

  async function handleRestore(description: string) {
    if (!restoreTarget || !historyFileId) return;
    const restoredNumber = restoreTarget.versionNumber;
    await apiRestoreVersion(historyFileId, restoreTarget.id, description);
    setRestoreTarget(null);
    await Promise.all([refreshHistory(), refreshFiles()]);
    showToast({
      title: t("toast.versionRestored", { version: restoredNumber }),
      description: t("toast.newVersionCreated"),
    });
  }

  async function handleEditVersionDescription(version: FileVersion, description: string) {
    await updateVersionDescription(version.id, description);
    await refreshHistory();
    await refreshFiles();
    showToast({ title: t("toast.versionDescriptionUpdated") });
  }

  async function handleDeleteVersion() {
    if (!deleteVersionTarget || !historyFileId) return;
    const deletedNumber = deleteVersionTarget.versionNumber;
    const result = await apiDeleteVersion(deleteVersionTarget.id);
    setDeleteVersionTarget(null);
    if (result === null) {
      setHistoryFileId(null);
    } else {
      await refreshHistory();
    }
    await refreshFiles();
    showToast({ title: t("toast.versionDeleted", { version: deletedNumber }) });
  }

  async function handleDeleteFile() {
    if (!deleteFileTarget) return;
    await apiDeleteFile(deleteFileTarget.id);
    setDeleteFileTarget(null);
    await refreshFiles();
    showToast({ title: t("toast.fileDeleted") });
  }

  async function handleRename(newName: string) {
    if (!renameTarget) return;
    await apiRenameFile(renameTarget.id, newName);
    setRenameTarget(null);
    await refreshFiles();
    showToast({ title: t("toast.fileRenamed") });
  }

  async function handleCreateFolder(name: string) {
    await apiCreateFolder(project.id, currentFolderId, name);
    setNewFolderOpen(false);
    await refreshFolders();
    showToast({ title: t("toast.folderCreated") });
  }

  async function handleRenameFolder(newName: string) {
    if (!renameFolderTarget) return;
    await apiRenameFolder(renameFolderTarget.id, newName);
    setRenameFolderTarget(null);
    await refreshFolders();
    showToast({ title: t("toast.folderRenamed") });
  }

  async function handleReorderFiles(orderedIds: string[]) {
    await reorderFiles(orderedIds);
    await refreshFiles();
  }

  async function handleMoveFile(fileId: string, targetFolderId: string) {
    try {
      await moveFile(fileId, targetFolderId);
      await Promise.all([refreshFiles(), refreshFolders()]);
      showToast({ title: t("toast.fileMoved") });
    } catch (e) {
      showToast({
        title: t("toast.moveError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleMoveFolder(folderId: string, targetFolderId: string) {
    try {
      await moveFolder(folderId, targetFolderId);
      await refreshFolders();
      showToast({ title: t("toast.folderMoved") });
    } catch (e) {
      showToast({
        title: t("toast.moveError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleDeleteFolder() {
    if (!deleteFolderTarget) return;
    await apiDeleteFolder(deleteFolderTarget.id);
    setDeleteFolderTarget(null);
    await refreshFolders();
    showToast({ title: t("toast.folderDeleted") });
  }

  async function handleSaveProject(name: string, description: string) {
    const updated = await updateProject(project.id, name, description);
    setEditProjectOpen(false);
    onProjectUpdated(updated);
  }

  async function handleDeleteProject() {
    await apiDeleteProject(project.id);
    setDeleteProjectOpen(false);
    onProjectDeleted();
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="drag-region flex shrink-0 items-start justify-between px-6 pb-2 pt-10">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold text-label-primary">{project.name}</h1>
          {project.description && (
            <ExpandableDescription
              text={project.description}
              className="mt-1 max-w-xl"
              textClassName="text-[12.5px] leading-relaxed text-label-secondary"
              collapsedLines={2}
              expandedMaxHeight={160}
            />
          )}
        </div>
        <div className="no-drag flex shrink-0 gap-1.5 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setEditProjectOpen(true)}>
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => setDeleteProjectOpen(true)}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <Breadcrumb entries={breadcrumb} onNavigate={navigateBreadcrumb} />

      <FileList
        folders={search ? [] : folders}
        files={files}
        loading={filesLoading}
        search={search}
        onSearchChange={setSearch}
        sortField={sortField}
        sortDir={sortDir}
        onSortChange={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        onUploadClick={handleUploadClick}
        onNewFolderClick={() => setNewFolderOpen(true)}
        isDragActive={isDragActive}
        dropTarget={dropTarget}
        onOpen={handleOpenFile}
        onDownload={handleDownloadFile}
        onUploadNewVersion={handleUploadNewVersionClick}
        onViewHistory={openHistory}
        onShowWhatsNew={(f) => setWhatsNewTarget(f)}
        onRename={(f) => setRenameTarget(f)}
        onDelete={(f) => setDeleteFileTarget(f)}
        onOpenFolder={openFolder}
        onRenameFolder={(f) => setRenameFolderTarget(f)}
        onDeleteFolder={(f) => setDeleteFolderTarget(f)}
        onReorderFiles={handleReorderFiles}
        onMoveFile={handleMoveFile}
        onMoveFolder={handleMoveFolder}
        onDragStateChange={(active) => {
          inAppDragActiveRef.current = active;
        }}
      />

      <VersionHistory
        open={historyFileId !== null}
        detail={detail}
        loading={historyLoading}
        isDragActive={isDragActive}
        dragPosition={dragPosition}
        onClose={() => setHistoryFileId(null)}
        onUploadNewVersion={async () => {
          if (!detail) return;
          const paths = await pickFilesToUpload(false);
          if (paths.length === 0) return;
          setUploadTarget({ mode: "new-version", file: detail, sourcePath: paths[0] });
        }}
        onOpen={handleOpenVersion}
        onDownload={handleDownloadVersion}
        onRestore={(v) => setRestoreTarget(v)}
        onDelete={(v) => setDeleteVersionTarget(v)}
        onEditDescription={handleEditVersionDescription}
      />

      <VersionInfoModal
        open={whatsNewTarget !== null}
        file={whatsNewTarget}
        onClose={() => setWhatsNewTarget(null)}
      />

      <UploadModal
        open={uploadTarget !== null}
        fileLabel={
          uploadTarget?.mode === "new-file"
            ? uploadTarget.sourcePath.split(/[/\\]/).pop() ?? ""
            : uploadTarget?.file.name ?? ""
        }
        versionLabel={uploadTarget?.mode === "new-file" ? "v1" : `v${uploadTarget?.file.nextVersionNumber ?? 1}`}
        isNewFile={uploadTarget?.mode === "new-file"}
        candidatePaths={uploadTarget?.mode === "new-version" ? uploadTarget.candidatePaths : undefined}
        selectedPath={uploadTarget?.sourcePath}
        onSelectPath={(sourcePath) =>
          setUploadTarget((prev) => (prev && prev.mode === "new-version" ? { ...prev, sourcePath } : prev))
        }
        upload={async (description, operationId) => {
          if (!uploadTarget) throw new Error("No upload target");
          if (uploadTarget.mode === "new-file") {
            return uploadFile(project.id, uploadTarget.folderId, uploadTarget.sourcePath, description, operationId);
          }
          return uploadNewVersion(uploadTarget.file.id, uploadTarget.sourcePath, description, operationId);
        }}
        onSuccess={async (entry) => {
          setUploadTarget(null);
          await refreshFiles();
          if (historyFileId === entry.id) await refreshHistory();
          showToast({
            title: t("toast.fileUploaded"),
            description: t("toast.versionCreated", { version: entry.currentVersion?.versionNumber ?? "" }),
          });
        }}
        onCancel={() => setUploadTarget(null)}
      />

      <RestoreModal
        open={restoreTarget !== null}
        versionNumber={restoreTarget?.versionNumber ?? null}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
      />

      <DeleteModal
        open={deleteVersionTarget !== null}
        title={t("delete.versionTitle", { version: deleteVersionTarget?.versionNumber ?? "" })}
        message={t("delete.versionMessage")}
        onCancel={() => setDeleteVersionTarget(null)}
        onConfirm={handleDeleteVersion}
      />

      <DeleteModal
        open={deleteFileTarget !== null}
        title={t("delete.fileTitle", { name: deleteFileTarget?.name ?? "" })}
        message={t("delete.fileMessage")}
        onCancel={() => setDeleteFileTarget(null)}
        onConfirm={handleDeleteFile}
      />

      <RenameModal
        open={renameTarget !== null}
        currentName={renameTarget?.name ?? ""}
        title={t("rename.fileTitle")}
        emptyError={t("rename.fileEmptyError")}
        errorFallback={t("rename.fileErrorFallback")}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />

      <NewFolderModal
        open={newFolderOpen}
        onCancel={() => setNewFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />

      <RenameModal
        open={renameFolderTarget !== null}
        currentName={renameFolderTarget?.name ?? ""}
        title={t("rename.folderTitle")}
        emptyError={t("rename.folderEmptyError")}
        errorFallback={t("rename.folderErrorFallback")}
        onCancel={() => setRenameFolderTarget(null)}
        onConfirm={handleRenameFolder}
      />

      <DeleteModal
        open={deleteFolderTarget !== null}
        title={t("delete.folderTitle", { name: deleteFolderTarget?.name ?? "" })}
        message={t("delete.folderMessage")}
        onCancel={() => setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolder}
      />

      <ProjectModal
        open={editProjectOpen}
        project={project}
        onCancel={() => setEditProjectOpen(false)}
        onConfirm={handleSaveProject}
      />

      <DeleteModal
        open={deleteProjectOpen}
        title={t("delete.projectTitle")}
        message={t("delete.projectMessage")}
        confirmValue={project.name}
        onCancel={() => setDeleteProjectOpen(false)}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
