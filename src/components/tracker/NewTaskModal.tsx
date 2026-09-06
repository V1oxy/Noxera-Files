import { FileText, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { FilePickerModal, type FilePickerResult } from "@/components/tracker/FilePickerModal";
import { useTrackerBoards, useTrackerStatuses } from "@/hooks/useTracker";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError, createTrackerTask } from "@/services/api";
import type { Priority, TrackerTaskDetail } from "@/types";

export type NewTaskInitialFile = FilePickerResult;

interface NewTaskModalProps {
  open: boolean;
  defaultBoardId?: string | null;
  defaultStatusId?: string | null;
  initialFile?: NewTaskInitialFile | null;
  onCancel: () => void;
  onCreated: (detail: TrackerTaskDetail) => void;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewTaskModal({ open, defaultBoardId, defaultStatusId, initialFile, onCancel, onCreated }: NewTaskModalProps) {
  const { t, translateError } = useLanguage();
  const { boards } = useTrackerBoards();
  const [boardId, setBoardId] = useState<string>("");
  const { statuses } = useTrackerStatuses(boardId || null);
  const [statusId, setStatusId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [receivedAt, setReceivedAt] = useState(todayDate());
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<FilePickerResult | null>(initialFile ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBoardId(defaultBoardId ?? boards[0]?.id ?? "");
    setStatusId(defaultStatusId ?? "");
    setTitle("");
    setCustomer("");
    setPriority("normal");
    setReceivedAt(todayDate());
    setDueAt("");
    setDescription("");
    setFile(initialFile ?? null);
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  useEffect(() => {
    if (!statusId && statuses.length > 0) {
      const def = statuses.find((s) => s.isDefault) ?? statuses[0];
      setStatusId(def.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  async function handleConfirm() {
    if (!title.trim()) {
      setError(t("tracker.titleRequired"));
      return;
    }
    if (!boardId || !statusId) {
      setError(t("tracker.boardRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail = await createTrackerTask({
        boardId,
        statusId,
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: file?.project.id,
        customer: customer.trim() || undefined,
        priority,
        receivedAt,
        dueAt: dueAt || undefined,
        files: file ? [{ fileId: file.file.id, versionId: file.alwaysLatest ? undefined : file.versionId, alwaysLatest: file.alwaysLatest }] : undefined,
      });
      onCreated(detail);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("tracker.createError"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]";
  const labelClass = "text-[11px] font-medium uppercase tracking-wide text-label-tertiary";

  return (
    <>
      <Modal open={open} onClose={onCancel} width={520}>
        <ModalHeader title={t("tracker.newTask")} />
        <ModalBody>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-0.5">
            <div>
              <label className={labelClass}>{t("tracker.fieldTitle")}</label>
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("tracker.board")}</label>
                <select value={boardId} onChange={(e) => { setBoardId(e.target.value); setStatusId(""); }} disabled={busy} className={`mt-1 ${inputClass}`}>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("tracker.status")}</label>
                <select value={statusId} onChange={(e) => setStatusId(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`}>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {file ? (
              <div className="rounded-apple border border-surface-border bg-surface-card p-2.5">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="shrink-0 text-label-secondary" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-label-primary">{file.file.name}</span>
                  {file.alwaysLatest && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/[0.12] px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      <RefreshCw size={9} />
                      {t("tracker.alwaysLatestShort")}
                    </span>
                  )}
                  <button onClick={() => setFile(null)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
                    <X size={13} />
                  </button>
                </div>
                <p className="mt-1 truncate text-[11px] text-label-secondary">{file.project.name}</p>
              </div>
            ) : (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-apple-sm border border-dashed border-surface-border py-2 text-[12.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
              >
                <FileText size={14} />
                {t("tracker.addFileFromStorage")}
              </button>
            )}

            <div>
              <label className={labelClass}>{t("tracker.fieldCustomer")}</label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t("tracker.fieldPriority")}</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} disabled={busy} className={`mt-1 ${inputClass}`}>
                  <option value="low">{t("tracker.priority.low")}</option>
                  <option value="normal">{t("tracker.priority.normal")}</option>
                  <option value="high">{t("tracker.priority.high")}</option>
                  <option value="critical">{t("tracker.priority.critical")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("tracker.fieldReceivedAt")}</label>
                <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t("tracker.fieldDueAt")}</label>
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`} />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("tracker.fieldDescription")}</label>
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
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={busy}>
            {t("common.create")}
          </Button>
        </ModalFooter>
      </Modal>

      <FilePickerModal open={pickerOpen} onCancel={() => setPickerOpen(false)} onConfirm={(result) => { setFile(result); setPickerOpen(false); }} />
    </>
  );
}
