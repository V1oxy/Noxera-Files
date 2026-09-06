import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError, duplicateTrackerTask } from "@/services/api";
import type { DuplicateTaskOptions } from "@/types";

interface DuplicateTaskModalProps {
  open: boolean;
  taskId: string;
  onCancel: () => void;
  onDuplicated: () => void;
}

const DEFAULTS: DuplicateTaskOptions = {
  description: true,
  fieldValues: true,
  priority: true,
  assignee: true,
  files: true,
  dueAt: false,
};

export function DuplicateTaskModal({ open, taskId, onCancel, onDuplicated }: DuplicateTaskModalProps) {
  const { t, translateError } = useLanguage();
  const [options, setOptions] = useState<DuplicateTaskOptions>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOptions(DEFAULTS);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await duplicateTrackerTask(taskId, options);
      onDuplicated();
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    } finally {
      setBusy(false);
    }
  }

  const rows: { key: keyof DuplicateTaskOptions; label: string }[] = [
    { key: "description", label: t("tracker.fieldDescription") },
    { key: "fieldValues", label: t("tracker.customFields") },
    { key: "priority", label: t("tracker.fieldPriority") },
    { key: "assignee", label: t("tracker.fieldAssignee") },
    { key: "files", label: t("tracker.tabFiles") },
  ];

  return (
    <Modal open={open} onClose={onCancel} width={380}>
      <ModalHeader title={t("tracker.duplicateTaskTitle")} subtitle={t("tracker.duplicateTaskSubtitle")} />
      <ModalBody>
        <div className="space-y-1">
          {rows.map((row) => (
            <label key={row.key} className="flex items-center justify-between rounded-apple-sm px-1 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
              <span className="text-[13px] text-label-primary">{row.label}</span>
              <input
                type="checkbox"
                checked={options[row.key]}
                onChange={(e) => setOptions((prev) => ({ ...prev, [row.key]: e.target.checked }))}
                disabled={busy}
                className="h-4 w-4 accent-accent"
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {t("tracker.duplicate")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
