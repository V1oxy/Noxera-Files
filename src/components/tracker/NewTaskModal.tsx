import { FileText, HardDrive, Link as LinkIcon, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { Select } from "@/components/Select";
import { CustomFieldInputs, fieldLabelClass } from "@/components/tracker/CustomFieldInputs";
import { FilePickerModal, type FilePickerResult } from "@/components/tracker/FilePickerModal";
import { LinkPickerModal } from "@/components/tracker/LinkPickerModal";
import { useTrackerBoards, useTrackerFields, useTrackerPriorities, useTrackerStatuses } from "@/hooks/useTracker";
import { useLanguage } from "@/hooks/useLanguage";
import {
  addTrackerTaskAdhocLink,
  addTrackerTaskLocalFile,
  ApiError,
  attachTrackerTaskLink,
  createTrackerTask,
  pickFilesToUpload,
} from "@/services/api";
import type { Link, TrackerFieldValue, TrackerTaskDetail } from "@/types";

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export type NewTaskInitialFile = FilePickerResult;
export type NewTaskInitialLink = Link;

interface NewTaskModalProps {
  open: boolean;
  defaultBoardId?: string | null;
  defaultStatusId?: string | null;
  initialFile?: NewTaskInitialFile | null;
  initialLink?: NewTaskInitialLink | null;
  onCancel: () => void;
  onCreated: (detail: TrackerTaskDetail) => void;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]";
const labelClass = "text-[11px] font-medium uppercase tracking-wide text-label-tertiary";

export function NewTaskModal({ open, defaultBoardId, defaultStatusId, initialFile, initialLink, onCancel, onCreated }: NewTaskModalProps) {
  const { t, translateError } = useLanguage();
  const { boards } = useTrackerBoards();
  const [boardId, setBoardId] = useState<string>("");
  const { statuses } = useTrackerStatuses(boardId || null);
  const { priorities } = useTrackerPriorities(boardId || null);
  const { fields } = useTrackerFields(boardId || null);
  const [statusId, setStatusId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [priorityId, setPriorityId] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState(todayDate());
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FilePickerResult[]>(initialFile ? [initialFile] : []);
  const [localFilePaths, setLocalFilePaths] = useState<string[]>([]);
  const [links, setLinks] = useState<Link[]>(initialLink ? [initialLink] : []);
  const [adhocLinks, setAdhocLinks] = useState<{ title: string; url: string }[]>([]);
  const [adhocLinkFormOpen, setAdhocLinkFormOpen] = useState(false);
  const [adhocTitle, setAdhocTitle] = useState("");
  const [adhocUrl, setAdhocUrl] = useState("");
  const [fieldValues, setFieldValues] = useState<Map<string, string | null>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Re-synced every time the modal opens (not just once at mount) - this
  // component stays mounted between opens (see Modal), so without `open` in
  // the dependency list a second "New Task" click could leave state, and in
  // particular the auto-selected status/priority below, stuck from whatever
  // was last picked instead of freshly defaulted (the root cause behind
  // "выберите доску и статус" firing even though both look selected).
  useEffect(() => {
    if (!open) return;
    setBoardId(defaultBoardId ?? boards[0]?.id ?? "");
    setStatusId(defaultStatusId ?? "");
    setTitle(initialFile?.file.name ?? initialLink?.title ?? "");
    setPriorityId("");
    setReceivedAt(todayDate());
    setDescription("");
    setFiles(initialFile ? [initialFile] : []);
    setLocalFilePaths([]);
    setLinks(initialLink ? [initialLink] : []);
    setAdhocLinks([]);
    setAdhocLinkFormOpen(false);
    setAdhocTitle("");
    setAdhocUrl("");
    setFieldValues(new Map());
    setError(null);
    setBusy(false);
    setConfirmDiscardOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile, initialLink]);

  // Defensive fallback for boards resolving after the modal already opened
  // (e.g. the very first paint before useTrackerBoards' fetch lands).
  useEffect(() => {
    if (!open || boardId || boards.length === 0) return;
    setBoardId(defaultBoardId ?? boards[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boards]);

  useEffect(() => {
    if (!open) return;
    if (!statusId && statuses.length > 0) {
      const def = statuses.find((s) => s.isDefault) ?? statuses[0];
      setStatusId(def.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, open]);

  useEffect(() => {
    if (!open) return;
    if (!priorityId && priorities.length > 0) {
      const def = priorities.find((p) => p.isDefault) ?? priorities[0];
      setPriorityId(def.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorities, open]);

  // Custom fields default from the board's own field defaults (spec section
  // 6) the moment the board's fields load - only fills in fields the user
  // hasn't already touched, so switching boards never clobbers a value
  // already typed for a field that happens to exist on both.
  useEffect(() => {
    if (!open || fields.length === 0) return;
    setFieldValues((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const field of fields) {
        if (!next.has(field.id) && field.defaultValue != null) {
          next.set(field.id, field.defaultValue);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fields, open]);

  async function handleAddLocalFiles() {
    const paths = await pickFilesToUpload(true);
    if (paths.length > 0) setLocalFilePaths((prev) => [...prev, ...paths]);
  }

  function handleRemoveLocalFile(path: string) {
    setLocalFilePaths((prev) => prev.filter((p) => p !== path));
  }

  function handleAddStorageFile(result: FilePickerResult) {
    setFiles((prev) => [...prev, result]);
    setPickerOpen(false);
  }

  function handleRemoveStorageFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddStorageLink(link: Link) {
    setLinks((prev) => [...prev, link]);
    setLinkPickerOpen(false);
  }

  function handleRemoveStorageLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddAdhocLink() {
    if (!adhocTitle.trim() || !adhocUrl.trim()) return;
    setAdhocLinks((prev) => [...prev, { title: adhocTitle.trim(), url: adhocUrl.trim() }]);
    setAdhocTitle("");
    setAdhocUrl("");
    setAdhocLinkFormOpen(false);
  }

  function handleRemoveAdhocLink(index: number) {
    setAdhocLinks((prev) => prev.filter((_, i) => i !== index));
  }

  const isDirty =
    title.trim() !== "" ||
    description.trim() !== "" ||
    files.length > 0 ||
    localFilePaths.length > 0 ||
    links.length > 0 ||
    adhocLinks.length > 0 ||
    // Only counts a field as "touched" if it differs from its own default -
    // a board whose fields have defaults would otherwise flag a completely
    // untouched form as dirty the moment it opens (those defaults refill
    // identically every time, so losing them isn't a real loss).
    fields.some((field) => (fieldValues.get(field.id) ?? "") !== (field.defaultValue ?? ""));

  function handleRequestClose() {
    if (busy) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onCancel();
  }

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
      const fieldValuesInput: TrackerFieldValue[] = [...fieldValues.entries()]
        .filter(([, v]) => v !== null && v !== "")
        .map(([fieldId, value]) => ({ fieldId, value }));
      let detail = await createTrackerTask({
        boardId,
        statusId,
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: files[0]?.project.id,
        priorityId: priorityId || undefined,
        receivedAt,
        fieldValues: fieldValuesInput.length > 0 ? fieldValuesInput : undefined,
        files: files.length > 0 ? files.map((f) => ({ fileId: f.file.id, versionId: f.alwaysLatest ? undefined : f.versionId, alwaysLatest: f.alwaysLatest })) : undefined,
      });
      for (const path of localFilePaths) {
        detail = await addTrackerTaskLocalFile(detail.id, path);
      }
      for (const link of links) {
        detail = await attachTrackerTaskLink(detail.id, link.id);
      }
      for (const adhoc of adhocLinks) {
        detail = await addTrackerTaskAdhocLink(detail.id, adhoc.title, adhoc.url);
      }
      onCreated(detail);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("tracker.createError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={handleRequestClose} width={520}>
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
                <Select
                  className="mt-1"
                  value={boardId}
                  onChange={(v) => {
                    setBoardId(v);
                    setStatusId("");
                    setPriorityId("");
                  }}
                  disabled={busy}
                  options={boards.map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t("tracker.status")}</label>
                <Select
                  className="mt-1"
                  value={statusId}
                  onChange={setStatusId}
                  disabled={busy}
                  options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                />
              </div>
            </div>

            {files.map((f, i) => (
              <div key={`${f.file.id}-${i}`} className="rounded-apple border border-surface-border bg-surface-card p-2.5">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="shrink-0 text-label-secondary" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-label-primary">{f.file.name}</span>
                  {f.alwaysLatest && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/[0.12] px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      <RefreshCw size={9} />
                      {t("tracker.alwaysLatestShort")}
                    </span>
                  )}
                  <button onClick={() => handleRemoveStorageFile(i)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
                    <X size={13} />
                  </button>
                </div>
                <p className="mt-1 truncate text-[11px] text-label-secondary">{f.project.name}</p>
              </div>
            ))}

            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-apple-sm border border-dashed border-surface-border py-2 text-[12.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
            >
              <FileText size={14} />
              {t("tracker.addFileFromStorage")}
            </button>

            {localFilePaths.length > 0 && (
              <div className="space-y-1.5">
                {localFilePaths.map((path) => (
                  <div key={path} className="flex items-center gap-2 rounded-apple border border-surface-border bg-surface-card px-2.5 py-2">
                    <HardDrive size={14} className="shrink-0 text-label-secondary" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-label-primary">{baseName(path)}</span>
                    <button onClick={() => handleRemoveLocalFile(path)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleAddLocalFiles}
              className="flex w-full items-center justify-center gap-2 rounded-apple-sm border border-dashed border-surface-border py-2 text-[12.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
            >
              <HardDrive size={14} />
              {t("tracker.addFileFromComputer")}
            </button>

            {links.map((link, i) => (
              <div key={`${link.id}-${i}`} className="rounded-apple border border-surface-border bg-surface-card p-2.5">
                <div className="flex items-center gap-2">
                  <LinkIcon size={15} className="shrink-0 text-label-secondary" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-label-primary">{link.title}</span>
                  <button onClick={() => handleRemoveStorageLink(i)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
                    <X size={13} />
                  </button>
                </div>
                <p className="mt-1 truncate text-[11px] text-label-secondary">{link.url}</p>
              </div>
            ))}
            {adhocLinks.map((link, i) => (
              <div key={`${link.url}-${i}`} className="flex items-center gap-2 rounded-apple border border-surface-border bg-surface-card px-2.5 py-2">
                <LinkIcon size={14} className="shrink-0 text-label-secondary" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-label-primary">{link.title}</span>
                <button onClick={() => handleRemoveAdhocLink(i)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
                  <X size={13} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setLinkPickerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-apple-sm border border-dashed border-surface-border py-2 text-[12.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
            >
              <LinkIcon size={14} />
              {t("tracker.attachFromLinks")}
            </button>

            {adhocLinkFormOpen ? (
              <div className="rounded-apple border border-accent/40 bg-surface-card p-2">
                <input
                  autoFocus
                  value={adhocTitle}
                  onChange={(e) => setAdhocTitle(e.target.value)}
                  placeholder={t("tracker.linkTitlePlaceholder")}
                  className="w-full bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
                />
                <input
                  value={adhocUrl}
                  onChange={(e) => setAdhocUrl(e.target.value)}
                  placeholder={t("tracker.linkUrlPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddAdhocLink();
                    else if (e.key === "Escape") setAdhocLinkFormOpen(false);
                  }}
                  className="mt-1 w-full bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
                />
                <div className="mt-1.5 flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setAdhocLinkFormOpen(false);
                      setAdhocTitle("");
                      setAdhocUrl("");
                    }}
                    className="rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
                  >
                    <X size={13} />
                  </button>
                  <button
                    disabled={!adhocTitle.trim() || !adhocUrl.trim()}
                    onClick={handleAddAdhocLink}
                    className="rounded-apple-sm bg-accent px-2 py-1 text-[11.5px] font-medium text-white disabled:opacity-40"
                  >
                    {t("common.create")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdhocLinkFormOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-apple-sm border border-dashed border-surface-border py-2 text-[12.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
              >
                <Plus size={14} />
                {t("tracker.addPlainLink")}
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("tracker.fieldPriority")}</label>
                <Select className="mt-1" value={priorityId} onChange={setPriorityId} disabled={busy} options={priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }))} />
              </div>
              <div>
                <label className={labelClass}>{t("tracker.fieldReceivedAt")}</label>
                <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} disabled={busy} className={`mt-1 ${inputClass}`} />
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

            {fields.length > 0 && (
              <div>
                <label className={fieldLabelClass}>{t("tracker.customFields")}</label>
                <div className="mt-1.5">
                  <CustomFieldInputs
                    fields={fields}
                    values={fieldValues}
                    disabled={busy}
                    onChange={(fieldId, value) => setFieldValues((prev) => new Map(prev).set(fieldId, value))}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-[12px] text-danger">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={handleRequestClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={busy}>
            {t("common.create")}
          </Button>
        </ModalFooter>
      </Modal>

      <FilePickerModal open={pickerOpen} onCancel={() => setPickerOpen(false)} onConfirm={handleAddStorageFile} />

      <LinkPickerModal open={linkPickerOpen} onCancel={() => setLinkPickerOpen(false)} onConfirm={handleAddStorageLink} />

      <Modal open={confirmDiscardOpen} onClose={() => setConfirmDiscardOpen(false)} width={360}>
        <ModalHeader title={t("tracker.discardTaskTitle")} subtitle={t("tracker.discardTaskMessage")} />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmDiscardOpen(false)}>
            {t("common.no")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmDiscardOpen(false);
              onCancel();
            }}
          >
            {t("common.yes")}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
