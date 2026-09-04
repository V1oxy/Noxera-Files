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
  /**
   * When set, the delete button stays disabled until the user types this
   * exact value into a text field (GitHub's "type the repo name" pattern) -
   * an extra speed bump for destructive actions that are hard to undo.
   */
  confirmValue?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteModal({
  open,
  title,
  message,
  confirmLabel,
  confirmValue,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  const { t, translateError } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  function handleCancel() {
    if (busy) return;
    setError(null);
    setTyped("");
    onCancel();
  }

  async function handleConfirm() {
    if (confirmValue !== undefined && typed !== confirmValue) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setTyped("");
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    }
  }

  const confirmDisabled = busy || (confirmValue !== undefined && typed !== confirmValue);

  return (
    <Modal open={open} onClose={handleCancel} width={400}>
      <ModalHeader title={title} />
      <ModalBody>
        <p className="text-[13px] leading-relaxed text-label-secondary">{message}</p>
        {confirmValue !== undefined && (
          <div className="mt-3">
            <label className="text-[12px] leading-relaxed text-label-secondary">
              {t("delete.typeToConfirm", { name: confirmValue })}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={confirmValue}
              className="no-drag mt-1.5 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 py-1.5 text-[13px] text-label-primary placeholder:text-label-tertiary/70 outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !confirmDisabled) handleConfirm();
              }}
            />
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={confirmDisabled}>
          {confirmLabel ?? t("common.delete")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
