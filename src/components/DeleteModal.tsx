import { useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";

interface DeleteModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteModal({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  const { t, translateError } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (busy) return;
    setError(null);
    onCancel();
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={400}>
      <ModalHeader title={title} />
      <ModalBody>
        <p className="text-[13px] leading-relaxed text-label-secondary">{message}</p>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={busy}>
          {confirmLabel ?? t("common.delete")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
