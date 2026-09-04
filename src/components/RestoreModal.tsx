import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { ApiError } from "@/services/api";

interface RestoreModalProps {
  open: boolean;
  versionNumber: number | null;
  onCancel: () => void;
  onConfirm: (description: string) => Promise<void>;
}

export function RestoreModal({ open, versionNumber, onCancel, onConfirm }: RestoreModalProps) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription(versionNumber !== null ? `Restored from version v${versionNumber}` : "");
      setError(null);
      setBusy(false);
    }
  }, [open, versionNumber]);

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(description.trim());
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Unable to restore this version.");
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={420}>
      <ModalHeader
        title={`Restore v${versionNumber}?`}
        subtitle="A new version will be created using the contents of this version. Existing versions will not be changed."
      />
      <ModalBody>
        <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={2}
          className="mt-1 w-full resize-none rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
        />
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          Restore
        </Button>
      </ModalFooter>
    </Modal>
  );
}
