import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { ApiError } from "@/services/api";
import type { Project } from "@/types";

interface ProjectModalProps {
  open: boolean;
  project?: Project | null;
  onCancel: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
}

export function ProjectModal({ open, project, onCancel, onConfirm }: ProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setError(null);
      setBusy(false);
    }
  }, [open, project]);

  function handleCancel() {
    if (busy) return;
    onCancel();
  }

  async function handleConfirm() {
    if (!name.trim()) {
      setError("Project name cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(name.trim(), description.trim());
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Unable to save this project.");
    }
  }

  return (
    <Modal open={open} onClose={handleCancel} width={420}>
      <ModalHeader title={project ? "Edit Project" : "New Project"} />
      <ModalBody>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="mt-1 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              rows={3}
              className="mt-1 w-full resize-none rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
            />
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {project ? "Save" : "Create"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
