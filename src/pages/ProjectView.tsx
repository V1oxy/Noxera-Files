import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Breadcrumb, type BreadcrumbEntry } from "@/components/Breadcrumb";
import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { FileList } from "@/components/FileList";
import { NewFolderModal } from "@/components/NewFolderModal";
import { ProjectModal } from "@/components/ProjectModal";
import { RenameModal } from "@/components/RenameModal";
import { RestoreModal } from "@/components/RestoreModal";
import { UploadModal } from "@/components/UploadModal";
import { VersionHistory } from "@/components/VersionHistory";
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
  openVersion,
  pickFilesToUpload,
  renameFile as apiRenameFile,
  renameFolder as apiRenameFolder,
  restoreVersion as apiRestoreVersion,
  updateProject,
  uploadFile,
  uploadNewVersion,
} from "@/services/api";
import type { FileEntry, FileVersion, Folder, Project, SortDirection, SortField } from "@/types";

type UploadTarget =
  | { mode: "new-file"; sourcePath: string; folderId: string | null }
  | { mode: "new-version"; file: FileEntry; sourcePath: string };

type DropTarget = { type: "file" | "folder"; id: string } | null;

interface ProjectViewProps {
  project: Project;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: () => void;
}

function resolveDropTarget(physicalX: number, physicalY: number): DropTarget {
  const dpr = window.devicePixelRatio || 1;
  const el = document.elementFromPoint(physicalX / dpr, physicalY / dpr);
  const target = el?.closest("[data-drop-target]") as HTMLElement | null;
  const type = target?.dataset.dropTarget as "file" | "folder" | undefined;
  const id = target?.dataset.rowId;
  if (!type || !id) return null;
  return { type, id };
}

export function ProjectView({ project, onProjectUpdated, onProjectDeleted }: ProjectViewProps) {
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
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const dropTargetRef = useRef<DropTarget>(null);

  useEffect(() => {
    setCurrentFolderId(null);
    setBreadcrumb([{ id: null, name: project.name }]);
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    setBreadcrumb((prev) => (prev.length > 0 ? [{ ...prev[0], name: project.name }, ...prev.slice(1)] : prev));
  }, [project.name]);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragActive(true);
        const target = resolveDropTarget(event.payload.position.x, event.payload.position.y);
        dropTargetRef.current = target;
        setDropTarget(target);
      } else if (event.payload.type === "leave") {
        setIsDragActive(false);
        dropTargetRef.current = null;
        setDropTarget(null);
      } else if (event.payload.type === "drop") {
        setIsDragActive(false);
        const target = dropTargetRef.current;
        dropTargetRef.current = null;
        setDropTarget(null);
        void handleIncomingPaths(event.payload.paths, target);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, currentFolderId, files, detail]);

  async function handleIncomingPaths(paths: string[], target: DropTarget) {
    if (paths.length === 0) return;

    if (target?.type === "file") {
      const targetFile = files.find((f) => f.id === target.id) ?? (detail?.id === target.id ? detail : null);
      if (targetFile) {
        setUploadTarget({ mode: "new-version", file: targetFile, sourcePath: paths[0] });
        return;
      }
    }

    const folderId = target?.type === "folder" ? target.id : currentFolderId;

    if (paths.length === 1) {
      setUploadTarget({ mode: "new-file", sourcePath: paths[0], folderId });
      return;
    }

    let succeeded = 0;
    for (const p of paths) {
      try {
        await uploadFile(project.id, folderId, p);
        succeeded++;
      } catch {
        // continue with the rest of the batch
      }
    }
    await Promise.all([refreshFiles(), refreshFolders()]);
    showToast({ title: t("toast.filesUploaded", { count: succeeded }) });
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
            <p className="mt-1 max-w-xl truncate text-[12.5px] text-label-secondary">{project.description}</p>
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
        onRename={(f) => setRenameTarget(f)}
        onDelete={(f) => setDeleteFileTarget(f)}
        onOpenFolder={openFolder}
        onRenameFolder={(f) => setRenameFolderTarget(f)}
        onDeleteFolder={(f) => setDeleteFolderTarget(f)}
      />

      <VersionHistory
        open={historyFileId !== null}
        detail={detail}
        loading={historyLoading}
        onClose={() => setHistoryFileId(null)}
        onUploadNewVersion={async () => {
          if (!detail) return;
          const paths = await pickFilesToUpload(false);
          if (paths.length === 0) return;
          setUploadTarget({ mode: "new-version", file: detail, sourcePath: paths[0] });
        }}
        onDownload={handleDownloadVersion}
        onRestore={(v) => setRestoreTarget(v)}
        onDelete={(v) => setDeleteVersionTarget(v)}
      />

      <UploadModal
        open={uploadTarget !== null}
        fileLabel={
          uploadTarget?.mode === "new-file"
            ? uploadTarget.sourcePath.split(/[/\\]/).pop() ?? ""
            : uploadTarget?.file.name ?? ""
        }
        versionLabel={uploadTarget?.mode === "new-file" ? "v1" : `v${uploadTarget?.file.nextVersionNumber ?? 1}`}
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
        onCancel={() => setDeleteProjectOpen(false)}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
