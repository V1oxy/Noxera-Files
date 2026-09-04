import { useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
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
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: DeleteModalProps) {
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
      setError(e instanceof ApiError ? e.message : "Unable to complete this action.");
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
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
