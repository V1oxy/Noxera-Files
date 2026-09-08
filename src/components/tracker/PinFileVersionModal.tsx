import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError, getFile } from "@/services/api";
import type { FileDetail, TrackerTaskFile } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

interface PinFileVersionModalProps {
  open: boolean;
  taskFile: TrackerTaskFile | null;
  onCancel: () => void;
  onConfirm: (versionId: string) => Promise<void>;
}

/**
 * Confirms switching an "always latest" attachment to a fixed version, and
 * lets the user choose *which* version to pin instead of silently locking
 * onto whatever happens to be current (spec: "дать выбор какую версию мы
 * фиксируем") - mirrors the version list FilePickerModal already shows when
 * attaching a file in the first place.
 */
export function PinFileVersionModal({ open, taskFile, onCancel, onConfirm }: PinFileVersionModalProps) {
  const { t, translateError, locale } = useLanguage();
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskFile) return;
    setDetail(null);
    setSelectedVersionId(taskFile.versionId);
    setError(null);
    setBusy(false);
    setLoading(true);
    let cancelled = false;
    getFile(taskFile.fileId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError(t("tracker.pinVersionLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskFile?.id]);

  async function handleConfirm() {
    if (!selectedVersionId) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(selectedVersionId);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} width={440}>
      <ModalHeader title={t("tracker.pinVersionTitle")} subtitle={t("tracker.pinVersionMessage")} />
      <ModalBody>
        {loading && <p className="py-4 text-center text-[12.5px] text-label-secondary">{t("files.loading")}</p>}
        {!loading && detail && (
          <div className="max-h-72 space-y-1 overflow-y-auto p-1">
            {detail.versions.map((v) => (
              <label
                key={v.id}
                className={`flex cursor-default items-center gap-2 rounded-apple-sm border px-2.5 py-1.5 text-[12.5px] ${
                  selectedVersionId === v.id ? "border-accent/50 bg-accent/[0.06]" : "border-surface-border"
                }`}
              >
                <input
                  type="radio"
                  name="pin-version"
                  checked={selectedVersionId === v.id}
                  onChange={() => setSelectedVersionId(v.id)}
                  className="accent-accent"
                />
                <span className="font-medium text-label-primary">v{v.versionNumber}</span>
                {v.id === taskFile?.versionId && (
                  <span className="rounded-full bg-black/[0.06] px-1.5 py-px text-[10px] text-label-tertiary dark:bg-white/[0.08]">
                    {t("tracker.pinVersionCurrent")}
                  </span>
                )}
                <span className="text-label-tertiary">{formatFullDateTime(v.createdAt, locale)}</span>
                <span className="ml-auto shrink-0 text-label-tertiary">{formatBytes(v.fileSize)}</span>
              </label>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy || loading || !selectedVersionId}>
          {t("tracker.pinVersionConfirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
