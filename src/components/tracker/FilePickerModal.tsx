import { ChevronRight, File as FileIcon, FolderClosed, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useFiles } from "@/hooks/useFiles";
import { useFolders } from "@/hooks/useFolders";
import { useLanguage } from "@/hooks/useLanguage";
import { useProjects } from "@/hooks/useProjects";
import { getFile } from "@/services/api";
import type { FileDetail, FileEntry, Project } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

export interface FilePickerResult {
  project: Project;
  file: FileEntry;
  versionId: string;
  alwaysLatest: boolean;
}

interface FilePickerModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (result: FilePickerResult) => void;
}

export function FilePickerModal({ open, onCancel, onConfirm }: FilePickerModalProps) {
  const { t, locale } = useLanguage();
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([]);
  const { folders } = useFolders(projectId, folderId);
  const { files } = useFiles(projectId, folderId, "", "name", "asc");

  const [pickedFile, setPickedFile] = useState<FileDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [alwaysLatest, setAlwaysLatest] = useState(true);

  useEffect(() => {
    if (open) {
      setProjectId(projects[0]?.id ?? null);
      setFolderId(null);
      setBreadcrumb([]);
      setPickedFile(null);
      setSelectedVersionId(null);
      setAlwaysLatest(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function openFile(file: FileEntry) {
    const detail = await getFile(file.id);
    setPickedFile(detail);
    setSelectedVersionId(detail.currentVersionId);
    setAlwaysLatest(true);
  }

  function openFolder(id: string, name: string) {
    setBreadcrumb((prev) => [...prev, { id, name }]);
    setFolderId(id);
  }

  function goToBreadcrumb(index: number) {
    if (index < 0) {
      setBreadcrumb([]);
      setFolderId(null);
      return;
    }
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    setFolderId(breadcrumb[index].id);
  }

  const project = projects.find((p) => p.id === projectId) ?? null;

  function handleConfirm() {
    if (!project || !pickedFile || !selectedVersionId) return;
    onConfirm({ project, file: pickedFile, versionId: selectedVersionId, alwaysLatest });
  }

  return (
    <Modal open={open} onClose={onCancel} width={520}>
      <ModalHeader title={t("tracker.pickFileTitle")} />
      <ModalBody>
        {!pickedFile ? (
          <div>
            <select
              value={projectId ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value || null);
                setFolderId(null);
                setBreadcrumb([]);
              }}
              className="w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 dark:bg-white/[0.05]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px] text-label-secondary">
              <button onClick={() => goToBreadcrumb(-1)} className="hover:text-label-primary hover:underline">
                {project?.name}
              </button>
              {breadcrumb.map((entry, i) => (
                <span key={entry.id} className="flex items-center gap-1">
                  <ChevronRight size={11} />
                  <button onClick={() => goToBreadcrumb(i)} className="hover:text-label-primary hover:underline">
                    {entry.name}
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto rounded-apple-sm border border-surface-border p-1.5">
              {folders.length === 0 && files.length === 0 && (
                <p className="px-2 py-6 text-center text-[12.5px] text-label-tertiary">{t("tracker.pickFileEmpty")}</p>
              )}
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => openFolder(folder.id, folder.name)}
                  className="flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                >
                  <FolderClosed size={15} className="shrink-0 text-label-secondary" />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <ChevronRight size={13} className="shrink-0 text-label-tertiary" />
                </button>
              ))}
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => openFile(file)}
                  className="flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                >
                  <FileIcon size={15} className="shrink-0 text-label-secondary" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  {file.currentVersion && (
                    <span className="shrink-0 text-[11px] text-label-tertiary">v{file.currentVersion.versionNumber}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setPickedFile(null)}
              className="mb-3 text-[12px] text-accent hover:underline"
            >
              {t("tracker.pickAnotherFile")}
            </button>
            <div className="rounded-apple border border-surface-border bg-surface-card p-3">
              <div className="flex items-center gap-2">
                <FileIcon size={16} className="shrink-0 text-label-secondary" />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-label-primary">{pickedFile.name}</p>
              </div>
              <p className="mt-1 truncate text-[11.5px] text-label-secondary">{project?.name}</p>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 rounded-apple border border-surface-border p-3">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-label-primary">
                  <RefreshCw size={13} className="text-accent" />
                  {t("tracker.alwaysLatest")}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-label-secondary">{t("tracker.alwaysLatestHint")}</span>
              </span>
              <input
                type="checkbox"
                checked={alwaysLatest}
                onChange={(e) => setAlwaysLatest(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
            </label>

            {!alwaysLatest && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {pickedFile.versions.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-default items-center gap-2 rounded-apple-sm border px-2.5 py-1.5 text-[12.5px] ${
                      selectedVersionId === v.id ? "border-accent/50 bg-accent/[0.06]" : "border-surface-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="version"
                      checked={selectedVersionId === v.id}
                      onChange={() => setSelectedVersionId(v.id)}
                      className="accent-accent"
                    />
                    <span className="font-medium text-label-primary">v{v.versionNumber}</span>
                    <span className="text-label-tertiary">{formatFullDateTime(v.createdAt, locale)}</span>
                    <span className="ml-auto text-label-tertiary">{formatBytes(v.fileSize)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!pickedFile || !selectedVersionId}>
          {t("tracker.useThisFile")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
