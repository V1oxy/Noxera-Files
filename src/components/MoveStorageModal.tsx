import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";

interface MoveStorageModalProps {
  open: boolean;
  targetPath: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/** Confirms before relocating the whole storage folder - a slow, all-or-nothing move of every project's files. */
export function MoveStorageModal({ open, targetPath, onCancel, onConfirm }: MoveStorageModalProps) {
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
      setError(e instanceof ApiError ? translateError(e.message) : t("settings.moveStorageErrorFallback"));
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={440}>
      <ModalHeader title={t("settings.moveStorageTitle")} subtitle={t("settings.moveStorageSubtitle")} />
      <ModalBody>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
            {t("settings.moveStorageDestination")}
          </p>
          <p className="mt-0.5 break-all text-[13px] text-label-primary">{targetPath}</p>
        </div>
        {busy && (
          <p className="mt-3 text-[12px] text-label-secondary">{t("settings.moveStorageInProgress")}</p>
        )}
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {busy ? t("settings.moveStorageMoving") : t("settings.moveStorageConfirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
