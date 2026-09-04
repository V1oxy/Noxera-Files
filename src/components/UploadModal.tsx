import { useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError, onUploadProgress } from "@/services/api";
import type { FileEntry } from "@/types";
import { formatBytes } from "@/utils/format";

interface UploadModalProps {
  open: boolean;
  fileLabel: string;
  versionLabel: string;
  isNewFile: boolean;
  upload: (description: string | undefined, operationId: string) => Promise<FileEntry>;
  onSuccess: (entry: FileEntry) => void;
  onCancel: () => void;
}

export function UploadModal({ open, fileLabel, versionLabel, isNewFile, upload, onSuccess, onCancel }: UploadModalProps) {
  const { t, translateError } = useLanguage();
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ written: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDescription("");
    setUploading(false);
    setProgress(null);
    setError(null);
  }

  function handleCancel() {
    if (uploading) return;
    reset();
    onCancel();
  }

  async function handleConfirm() {
    setUploading(true);
    setError(null);
    const operationId = crypto.randomUUID();
    const unlisten = await onUploadProgress((e) => {
      if (e.operationId === operationId) {
        setProgress({ written: e.bytesWritten, total: e.totalBytes });
      }
    });
    try {
      const entry = await upload(description.trim() || undefined, operationId);
      unlisten();
      reset();
      onSuccess(entry);
    } catch (e) {
      unlisten();
      setUploading(false);
      setError(e instanceof ApiError ? translateError(e.message) : t("upload.errorFallback"));
    }
  }

  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.written / progress.total) * 100)) : null;

  return (
    <Modal open={open} onClose={handleCancel} width={440}>
      <ModalHeader title={isNewFile ? t("upload.titleAddFile") : t("upload.titleNewVersion")} />
      <ModalBody>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("upload.file")}</p>
            <p className="mt-0.5 truncate text-[13px] text-label-primary">{fileLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("upload.version")}</p>
            <p className="mt-0.5 text-[13px] text-label-primary">{versionLabel}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
              {isNewFile ? t("upload.comment") : t("upload.whatChanged")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              rows={3}
              placeholder={isNewFile ? t("upload.commentPlaceholder") : t("upload.whatChangedPlaceholder")}
              className="mt-1 w-full resize-none rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] text-label-primary placeholder:text-label-tertiary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
            />
          </div>

          {uploading && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.1]">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: pct !== null ? `${pct}%` : "30%" }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-label-secondary">
                {progress && progress.total > 0
                  ? t("upload.uploadingProgress", {
                      pct: pct ?? 0,
                      written: formatBytes(progress.written),
                      total: formatBytes(progress.total),
                    })
                  : t("upload.uploading")}
              </p>
            </div>
          )}

          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={uploading}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={uploading}>
          {t("upload.confirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
