import { ExternalLink, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";
import type { TrackerTaskLocalFile, TrackerTaskLocalFileVersion } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

interface LocalFileVersionHistoryModalProps {
  open: boolean;
  localFile: TrackerTaskLocalFile | null;
  onClose: () => void;
  onView: (version: TrackerTaskLocalFileVersion) => void;
  onRestore: (version: TrackerTaskLocalFileVersion) => Promise<void>;
  onAddVersion: () => void;
}

/**
 * Lists every version of a local file attachment (spec: number, size,
 * date/time added) with actions to view or restore a past one - simpler
 * than the file manager's own `VersionHistory` (no "always latest" toggle,
 * no per-version description, no delete-a-single-version) since local file
 * attachments don't have any of that.
 */
export function LocalFileVersionHistoryModal({
  open,
  localFile,
  onClose,
  onView,
  onRestore,
  onAddVersion,
}: LocalFileVersionHistoryModalProps) {
  const { t, locale, translateError } = useLanguage();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore(version: TrackerTaskLocalFileVersion) {
    setRestoringId(version.id);
    setError(null);
    try {
      await onRestore(version);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <ModalHeader title={localFile?.fileName ?? t("menu.versionHistory")} subtitle={t("menu.versionHistory")} />
      <ModalBody>
        <div className="max-h-96 space-y-2 overflow-y-auto p-1">
          {localFile?.versions.map((v) => {
            const isCurrent = v.id === localFile.currentVersionId;
            return (
              <div
                key={v.id}
                className={`rounded-apple border p-3 ${
                  isCurrent ? "border-accent/40 bg-accent/[0.06]" : "border-surface-border bg-surface-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-label-primary">v{v.versionNumber}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {t("version.current")}
                      </span>
                    )}
                  </div>
                  <span className="text-[11.5px] text-label-tertiary">{formatBytes(v.fileSize)}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-label-secondary">{formatFullDateTime(v.addedAt, locale)}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => onView(v)}>
                    <ExternalLink size={13} />
                    {t("menu.open")}
                  </Button>
                  {!isCurrent && (
                    <Button size="sm" variant="secondary" onClick={() => handleRestore(v)} disabled={restoringId === v.id}>
                      <RotateCcw size={13} />
                      {t("common.restore")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button variant="primary" onClick={onAddVersion}>
          <Plus size={13} />
          {t("tracker.addNewLocalFileVersion")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
