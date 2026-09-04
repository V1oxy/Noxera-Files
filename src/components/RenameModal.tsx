import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { ApiError } from "@/services/api";

interface RenameModalProps {
  open: boolean;
  currentName: string;
  onCancel: () => void;
  onConfirm: (newName: string) => Promise<void>;
}

export function RenameModal({ open, currentName, onCancel, onConfirm }: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setBusy(false);
    }
  }, [open, currentName]);

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  async function handleConfirm() {
    if (!name.trim()) {
      setError("File name cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(name.trim());
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Unable to rename this file.");
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={380}>
      <ModalHeader title="Rename File" />
      <ModalBody>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
        />
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
}
