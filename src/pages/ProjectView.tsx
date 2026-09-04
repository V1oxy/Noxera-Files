import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { FileList } from "@/components/FileList";
import { ProjectModal } from "@/components/ProjectModal";
import { RenameModal } from "@/components/RenameModal";
import { RestoreModal } from "@/components/RestoreModal";
import { UploadModal } from "@/components/UploadModal";
import { VersionHistory } from "@/components/VersionHistory";
import { useFiles } from "@/hooks/useFiles";
import { useToast } from "@/hooks/useToast";
import { useVersions } from "@/hooks/useVersions";
import {
  ApiError,
  deleteFile as apiDeleteFile,
  deleteProject as apiDeleteProject,
  deleteVersion as apiDeleteVersion,
  downloadVersion,
  openVersion,
  pickFilesToUpload,
  renameFile as apiRenameFile,
  restoreVersion as apiRestoreVersion,
  updateProject,
  uploadFile,
  uploadNewVersion,
} from "@/services/api";
import type { FileEntry, Project, SortDirection, SortField, FileVersion } from "@/types";

type UploadTarget = { mode: "new-file"; sourcePath: string } | { mode: "new-version"; file: FileEntry; sourcePath: string };

interface ProjectViewProps {
  project: Project;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: () => void;
}

export function ProjectView({ project, onProjectUpdated, onProjectDeleted }: ProjectViewProps) {
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastModified");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const { files, loading: filesLoading, refresh: refreshFiles } = useFiles(project.id, search, sortField, sortDir);

  const [historyFileId, setHistoryFileId] = useState<string | null>(null);
  const { detail, loading: historyLoading, refresh: refreshHistory } = useVersions(historyFileId);

  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<FileVersion | null>(null);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<FileVersion | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    setSearch("");
  }, [project.id]);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragActive(true);
      } else if (event.payload.type === "leave") {
        setIsDragActive(false);
      } else if (event.payload.type === "drop") {
        setIsDragActive(false);
        void handleIncomingPaths(event.payload.paths);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleIncomingPaths(paths: string[]) {
    if (paths.length === 0) return;
    if (paths.length === 1) {
      setUploadTarget({ mode: "new-file", sourcePath: paths[0] });
      return;
    }
    let succeeded = 0;
    for (const p of paths) {
      try {
        await uploadFile(project.id, p);
        succeeded++;
      } catch {
        // continue with the rest of the batch
      }
    }
    await refreshFiles();
    showToast({ title: `${succeeded} file${succeeded === 1 ? "" : "s"} uploaded` });
  }

  async function handleUploadClick() {
    const paths = await pickFilesToUpload(true);
    await handleIncomingPaths(paths);
  }

  function openHistory(file: FileEntry) {
    setHistoryFileId(file.id);
  }

  async function handleOpenFile(file: FileEntry) {
    if (!file.currentVersion) return;
    try {
      await openVersion(file.currentVersion.id);
    } catch (e) {
      showToast({
        title: "Unable to open the file",
        description: e instanceof ApiError ? e.message : undefined,
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
      if (saved) showToast({ title: "Download complete" });
    } catch (e) {
      showToast({
        title: "Unable to download the file",
        description: e instanceof ApiError ? e.message : undefined,
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
    showToast({ title: `Version v${restoredNumber} restored`, description: "New version created" });
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
    showToast({ title: `Version v${deletedNumber} deleted` });
  }

  async function handleDeleteFile() {
    if (!deleteFileTarget) return;
    await apiDeleteFile(deleteFileTarget.id);
    setDeleteFileTarget(null);
    await refreshFiles();
    showToast({ title: "File deleted" });
  }

  async function handleRename(newName: string) {
    if (!renameTarget) return;
    await apiRenameFile(renameTarget.id, newName);
    setRenameTarget(null);
    await refreshFiles();
    showToast({ title: "File renamed" });
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

      <FileList
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
        isDragActive={isDragActive}
        onOpen={handleOpenFile}
        onDownload={handleDownloadFile}
        onUploadNewVersion={handleUploadNewVersionClick}
        onViewHistory={openHistory}
        onRename={(f) => setRenameTarget(f)}
        onDelete={(f) => setDeleteFileTarget(f)}
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
            return uploadFile(project.id, uploadTarget.sourcePath, description, operationId);
          }
          return uploadNewVersion(uploadTarget.file.id, uploadTarget.sourcePath, description, operationId);
        }}
        onSuccess={async (entry) => {
          setUploadTarget(null);
          await refreshFiles();
          if (historyFileId === entry.id) await refreshHistory();
          showToast({
            title: "File uploaded",
            description: `Version v${entry.currentVersion?.versionNumber} created`,
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
        title={`Delete v${deleteVersionTarget?.versionNumber}?`}
        message="The file of this version will be deleted from the computer. This action cannot be undone."
        onCancel={() => setDeleteVersionTarget(null)}
        onConfirm={handleDeleteVersion}
      />

      <DeleteModal
        open={deleteFileTarget !== null}
        title={`Delete "${deleteFileTarget?.name}"?`}
        message="This file and all of its versions will be deleted from this computer. This action cannot be undone."
        onCancel={() => setDeleteFileTarget(null)}
        onConfirm={handleDeleteFile}
      />

      <RenameModal
        open={renameTarget !== null}
        currentName={renameTarget?.name ?? ""}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />

      <ProjectModal
        open={editProjectOpen}
        project={project}
        onCancel={() => setEditProjectOpen(false)}
        onConfirm={handleSaveProject}
      />

      <DeleteModal
        open={deleteProjectOpen}
        title="Delete Project?"
        message="The project and all associated files will be deleted from this computer. This action cannot be undone."
        onCancel={() => setDeleteProjectOpen(false)}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
