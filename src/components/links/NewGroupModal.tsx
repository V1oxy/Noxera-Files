import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";

interface NewGroupModalProps {
  open: boolean;
  initialName?: string;
  onCancel: () => void;
  onConfirm: (name: string) => Promise<void>;
}

export function NewGroupModal({ open, initialName, onCancel, onConfirm }: NewGroupModalProps) {
  const { t, translateError } = useLanguage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setError(null);
      setBusy(false);
    }
  }, [open, initialName]);

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  async function handleConfirm() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(name.trim());
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={360}>
      <ModalHeader title={initialName ? t("links.renameGroup") : t("links.newGroup")} />
      <ModalBody>
        <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("links.groupName")}</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          placeholder={t("links.groupNamePlaceholder")}
          className="mt-1 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
        />
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {initialName ? t("common.save") : t("common.create")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
