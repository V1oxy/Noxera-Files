import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";

interface SwitchStorageModalProps {
  open: boolean;
  targetPath: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Confirms before pointing the app at a different folder - like switching
 * vaults in Obsidian, this doesn't move or copy anything: the new folder is
 * opened as-is (its own projects if it already has any, empty otherwise),
 * and the old location is left untouched so switching back later shows it
 * exactly as it was.
 */
export function SwitchStorageModal({ open, targetPath, onCancel, onConfirm }: SwitchStorageModalProps) {
  const { t, translateError } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? translateError(e.message) : t("settings.switchStorageErrorFallback"));
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={440}>
      <ModalHeader title={t("settings.switchStorageTitle")} subtitle={t("settings.switchStorageSubtitle")} />
      <ModalBody>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
            {t("settings.switchStorageDestination")}
          </p>
          <p className="mt-0.5 break-all text-[13px] text-label-primary">{targetPath}</p>
        </div>
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {t("settings.switchStorageConfirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
