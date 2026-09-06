import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  FolderClosed,
  HardDrive,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { DuplicateTaskModal } from "@/components/tracker/DuplicateTaskModal";
import { FilePickerModal, type FilePickerResult } from "@/components/tracker/FilePickerModal";
import { LabelChip, formatEventTime } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerFields, useTrackerLabels, useTrackerPriorities, useTrackerStatuses, useTrackerTaskDetail } from "@/hooks/useTracker";
import {
  ApiError,
  addTrackerTaskComment,
  addTrackerTaskLocalFile,
  attachTrackerTaskFile,
  deleteTrackerTask,
  detachTrackerTaskFile,
  openTrackerTaskLocalFile,
  openVersion,
  pickFilesToUpload,
  removeTrackerTaskLocalFile,
  setTrackerTaskArchived,
  setTrackerTaskFieldValues,
  setTrackerTaskFilePin,
  setTrackerTaskLabels,
  setTrackerTaskPinned,
  updateTrackerTask,
  moveTrackerTask,
} from "@/services/api";
import type { TrackerTaskEvent, TrackerTaskFile, TrackerTaskLocalFile, TrackerTaskUpdateInput } from "@/types";
import { formatBytes } from "@/utils/format";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleted: () => void;
}

const inputClass =
  "w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content dark:bg-white/[0.05]";
const labelClass = "block text-[10.5px] font-medium uppercase tracking-wide text-label-tertiary";
const fieldGroupClass = "space-y-1";

function PillSelect({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full bg-black/[0.05] py-1 pl-2.5 pr-6 text-[11.5px] font-medium text-label-primary outline-none transition-colors hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label-tertiary" />
    </div>
  );
}

export function TaskDetailPanel({ taskId, onClose, onChanged, onOpenProject, onDeleted }: TaskDetailPanelProps) {
  const { t, locale, translateError } = useLanguage();
  const { showToast } = useToast();
  const { detail, refresh } = useTrackerTaskDetail(taskId);
  const { statuses } = useTrackerStatuses(detail?.boardId ?? null);
  const { fields } = useTrackerFields(detail?.boardId ?? null);
  const { labels } = useTrackerLabels(detail?.boardId ?? null);
  const { priorities } = useTrackerPriorities(detail?.boardId ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [tab, setTab] = useState<"files" | "history">("files");

  useEffect(() => {
    if (detail) {
      setTitle(detail.title);
      setDescription(detail.description ?? "");
    }
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldValueMap = useMemo(() => {
    const map = new Map<string, string | null>();
    detail?.fieldValues.forEach((fv) => map.set(fv.fieldId, fv.value));
    return map;
  }, [detail?.fieldValues]);

  if (!detail) return null;

  async function patch(update: TrackerTaskUpdateInput) {
    try {
      await updateTrackerTask(taskId, update);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleStatusChange(statusId: string) {
    await moveTrackerTask(taskId, statusId, [taskId]);
    await refresh();
    onChanged();
  }

  async function handleFieldValue(fieldId: string, value: string) {
    const next = detail!.fieldValues.filter((fv) => fv.fieldId !== fieldId);
    next.push({ fieldId, value: value || null });
    await setTrackerTaskFieldValues(taskId, next);
    await refresh();
  }

  async function handleLabelToggle(labelId: string) {
    const has = detail!.labelIds.includes(labelId);
    const next = has ? detail!.labelIds.filter((id) => id !== labelId) : [...detail!.labelIds, labelId];
    await setTrackerTaskLabels(taskId, next);
    await refresh();
  }

  async function handleAddFile(result: FilePickerResult) {
    await attachTrackerTaskFile(taskId, {
      fileId: result.file.id,
      versionId: result.alwaysLatest ? undefined : result.versionId,
      alwaysLatest: result.alwaysLatest,
    });
    setPickerOpen(false);
    await refresh();
    onChanged();
  }

  async function handleRemoveFile(taskFile: TrackerTaskFile) {
    await detachTrackerTaskFile(taskFile.id);
    await refresh();
    onChanged();
  }

  async function handleOpenFile(taskFile: TrackerTaskFile) {
    if (!taskFile.versionExists || !taskFile.versionId) return;
    try {
      await openVersion(taskFile.versionId);
    } catch (e) {
      showToast({ title: t("toast.openFileError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleToggleFilePin(taskFile: TrackerTaskFile) {
    try {
      await setTrackerTaskFilePin(taskFile.id, !taskFile.alwaysLatest);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddLocalFiles() {
    const paths = await pickFilesToUpload(true);
    if (paths.length === 0) return;
    for (const path of paths) {
      await addTrackerTaskLocalFile(taskId, path);
    }
    await refresh();
    onChanged();
  }

  async function handleRemoveLocalFile(localFile: TrackerTaskLocalFile) {
    await removeTrackerTaskLocalFile(localFile.id);
    await refresh();
    onChanged();
  }

  async function handleOpenLocalFile(localFile: TrackerTaskLocalFile) {
    try {
      await openTrackerTaskLocalFile(localFile.id);
    } catch (e) {
      showToast({ title: t("toast.openFileError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    await addTrackerTaskComment(taskId, comment.trim());
    setComment("");
    await refresh();
  }

  async function handleTogglePin() {
    await setTrackerTaskPinned(taskId, !detail!.pinned);
    await refresh();
    onChanged();
  }

  async function handleToggleArchive() {
    await setTrackerTaskArchived(taskId, !detail!.archived);
    await refresh();
    onChanged();
    showToast({ title: detail!.archived ? t("tracker.restoredFromArchive") : t("tracker.archived") });
  }

  async function handleDelete() {
    await deleteTrackerTask(taskId);
    onDeleted();
  }

  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name }));
  const priorityOptions = priorities.map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="animate-scale-in flex h-[82vh] w-[760px] max-w-[95vw] flex-col rounded-apple-lg border border-surface-border bg-surface-modal shadow-modal backdrop-blur-apple" onMouseDown={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== detail.title && patch({ title: title.trim() })}
                className="w-full bg-transparent text-[17px] font-semibold text-label-primary outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <PillSelect value={detail.statusId} onChange={handleStatusChange} options={statusOptions} />
                <PillSelect value={detail.priorityId} onChange={(v) => patch({ priorityId: v })} options={priorityOptions} />
                {detail.projectName && detail.projectId && (
                  <button
                    onClick={() => onOpenProject(detail.projectId!)}
                    className="flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-label-primary transition-colors hover:bg-accent hover:text-white dark:bg-white/[0.08]"
                  >
                    <FolderClosed size={11} />
                    {detail.projectName}
                  </button>
                )}
                {labels
                  .filter((l) => detail.labelIds.includes(l.id))
                  .map((l) => (
                    <LabelChip key={l.id} name={l.name} color={l.color} />
                  ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={handleTogglePin} title={t(detail.pinned ? "tracker.unpin" : "tracker.pin")} className="rounded-apple-sm p-1.5 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]">
                {detail.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
              <button onClick={onClose} className="rounded-apple-sm p-1.5 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-y-auto p-5">
              <div className="space-y-4">
                <div className={fieldGroupClass}>
                  <label className={labelClass}>{t("tracker.fieldDescription")}</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => description !== (detail.description ?? "") && patch({ description: description.trim() || null })}
                    rows={4}
                    placeholder={t("tracker.descriptionPlaceholder")}
                    className="w-full resize-y rounded-apple-sm border border-surface-border bg-black/[0.03] p-2.5 text-[13px] leading-relaxed text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 focus:bg-surface-content dark:bg-white/[0.05]"
                  />
                </div>

                <div className={`grid ${detail.completedAt ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                  <div className={fieldGroupClass}>
                    <label className={labelClass}>{t("tracker.fieldReceivedAt")}</label>
                    <input type="date" value={detail.receivedAt.slice(0, 10)} onChange={(e) => patch({ receivedAt: e.target.value })} className={inputClass} />
                  </div>
                  {detail.completedAt && (
                    <div className={fieldGroupClass}>
                      <label className={labelClass}>{t("tracker.fieldCompletedAt")}</label>
                      <input
                        type="date"
                        value={detail.completedAt.slice(0, 10)}
                        onChange={(e) => patch({ completedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>

                {fields.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {fields.map((field) => {
                    const value = fieldValueMap.get(field.id) ?? "";
                    if (field.fieldType === "select") {
                      return (
                        <div key={field.id} className={fieldGroupClass}>
                          <label className={labelClass}>{field.name}</label>
                          <select defaultValue={value} key={`${field.id}-${detail.id}`} onChange={(e) => handleFieldValue(field.id, e.target.value)} className={inputClass}>
                            <option value="" />
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    if (field.fieldType === "boolean") {
                      return (
                        <label key={field.id} className="flex items-end gap-2 pb-1.5">
                          <input type="checkbox" defaultChecked={value === "true"} key={`${field.id}-${detail.id}`} onChange={(e) => handleFieldValue(field.id, e.target.checked ? "true" : "false")} className="h-4 w-4 accent-accent" />
                          <span className="text-[12.5px] text-label-primary">{field.name}</span>
                        </label>
                      );
                    }
                    const type = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "datetime" ? "datetime-local" : field.fieldType === "url" ? "url" : "text";
                    return (
                      <div key={field.id} className={fieldGroupClass}>
                        <label className={labelClass}>{field.name}</label>
                        <input type={type} defaultValue={value} key={`${field.id}-${detail.id}`} onBlur={(e) => handleFieldValue(field.id, e.target.value)} className={inputClass} />
                      </div>
                    );
                  })}
                </div>
                )}

                {labels.length > 0 && (
                  <div className={fieldGroupClass}>
                    <label className={labelClass}>{t("tracker.labels")}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((l) => {
                        const active = detail.labelIds.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => handleLabelToggle(l.id)}
                            className="rounded-full px-2 py-1 text-[11px] font-medium transition-opacity"
                            style={{ backgroundColor: l.color, color: "white", opacity: active ? 1 : 0.35 }}
                          >
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="mt-5 space-y-2 border-t border-surface-border pt-4">
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setDuplicateOpen(true)}>
                    <Copy size={13} />
                    {t("tracker.duplicate")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleToggleArchive}>
                    {detail.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                    {t(detail.archived ? "tracker.unarchive" : "tracker.archive")}
                  </Button>
                </div>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-1.5 rounded-apple-sm px-1.5 py-1 text-[12px] text-label-tertiary transition-colors hover:text-danger"
                >
                  <Trash2 size={12} />
                  {t("tracker.deleteTask")}
                </button>
              </div>
            </div>

            {/* Sidebar: files + history */}
            <div className="flex w-80 shrink-0 flex-col border-l border-surface-border bg-black/[0.012] dark:bg-white/[0.015]">
              <div className="flex shrink-0 gap-4 border-b border-surface-border px-4 pt-3">
                <button onClick={() => setTab("files")} className={`relative pb-2.5 text-[12px] font-medium transition-colors ${tab === "files" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
                  {t("tracker.tabFiles")} {detail.files.length + detail.localFiles.length > 0 && `(${detail.files.length + detail.localFiles.length})`}
                  {tab === "files" && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
                <button onClick={() => setTab("history")} className={`relative pb-2.5 text-[12px] font-medium transition-colors ${tab === "history" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
                  {t("tracker.tabHistory")}
                  {tab === "history" && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
              </div>

              {tab === "files" ? (
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {detail.files.map((f) => (
                    <div key={f.id} className="group rounded-apple border border-surface-border bg-surface-card p-2.5 shadow-card">
                      <div className="flex items-start gap-2">
                        <FileText size={15} className="mt-0.5 shrink-0 text-label-secondary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-label-primary">{f.fileName}</p>
                          {!f.fileExists ? (
                            <p className="mt-1 text-[11px] text-danger">{t("tracker.fileGone")}</p>
                          ) : !f.versionExists ? (
                            <p className="mt-1 text-[11px] text-danger">{t("tracker.versionGone")}</p>
                          ) : (
                            <>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-label-secondary">
                                <span className="font-medium">v{f.versionNumber}</span>
                                <span className="text-label-tertiary">·</span>
                                <span className="text-label-tertiary">{formatBytes(f.fileSize ?? 0)}</span>
                              </p>
                              <button
                                onClick={() => handleToggleFilePin(f)}
                                title={t(f.alwaysLatest ? "tracker.switchToPinnedVersion" : "tracker.switchToLatestVersion")}
                                className={`mt-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                  f.alwaysLatest
                                    ? "bg-accent/[0.12] text-accent hover:bg-accent/[0.18]"
                                    : "bg-black/[0.06] text-label-secondary hover:bg-black/[0.1] dark:bg-white/[0.08]"
                                }`}
                              >
                                <RefreshCw size={9} />
                                {t(f.alwaysLatest ? "tracker.versionCurrentBadge" : "tracker.versionPinnedBadge")}
                              </button>
                              {f.projectName && <p className="mt-1 text-[10.5px] text-label-tertiary">{t("tracker.fileProjectLabel", { name: f.projectName })}</p>}
                              {f.unseenUpdate && (
                                <p className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-accent">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                  {t("tracker.fileUpdatedToVersion", { version: f.versionNumber ?? "" })}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        <button onClick={() => handleRemoveFile(f)} title={t("tracker.removeFile")} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
                          <X size={12} />
                        </button>
                      </div>
                      {f.fileExists && f.versionExists && (
                        <button onClick={() => handleOpenFile(f)} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                          <ExternalLink size={11} />
                          {t("menu.open")}
                        </button>
                      )}
                    </div>
                  ))}
                  {detail.localFiles.map((lf) => (
                    <div key={lf.id} className="group rounded-apple border border-surface-border bg-surface-card p-2.5 shadow-card">
                      <div className="flex items-start gap-2">
                        <HardDrive size={15} className="mt-0.5 shrink-0 text-label-secondary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-label-primary">{lf.fileName}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-label-secondary">
                            <span className="text-label-tertiary">{formatBytes(lf.fileSize)}</span>
                            <span className="text-label-tertiary">·</span>
                            <span className="text-label-tertiary">{t("tracker.localFileBadge")}</span>
                          </p>
                        </div>
                        <button onClick={() => handleRemoveLocalFile(lf)} title={t("tracker.removeFile")} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
                          <X size={12} />
                        </button>
                      </div>
                      <button onClick={() => handleOpenLocalFile(lf)} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                        <ExternalLink size={11} />
                        {t("menu.open")}
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="flex items-center justify-center gap-1.5 rounded-apple-sm border border-dashed border-surface-border py-2 text-[11.5px] text-label-secondary transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      <Plus size={13} />
                      {t("tracker.addFileFromStorage")}
                    </button>
                    <button
                      onClick={handleAddLocalFiles}
                      className="flex items-center justify-center gap-1.5 rounded-apple-sm border border-dashed border-surface-border py-2 text-[11.5px] text-label-secondary transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      <HardDrive size={13} />
                      {t("tracker.addFileFromComputer")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {detail.events.map((ev, i) => (
                      <HistoryEntry key={ev.id} event={ev} isLast={i === detail.events.length - 1} />
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-1.5 border-t border-surface-border p-2.5">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      placeholder={t("tracker.commentPlaceholder")}
                      className="min-w-0 flex-1 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[12px] text-label-primary outline-none placeholder:text-label-tertiary dark:bg-white/[0.05]"
                    />
                    <Button size="sm" variant="primary" onClick={handleAddComment}>
                      <MessageSquare size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilePickerModal open={pickerOpen} onCancel={() => setPickerOpen(false)} onConfirm={handleAddFile} />

      <DeleteModal
        open={deleteOpen}
        title={t("tracker.deleteTaskTitle")}
        message={t("tracker.deleteTaskMessage")}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <DuplicateTaskModal open={duplicateOpen} taskId={taskId} onCancel={() => setDuplicateOpen(false)} onDuplicated={() => { setDuplicateOpen(false); onChanged(); }} />
    </>
  );
}

function eventText(event: TrackerTaskEvent, t: (key: string, vars?: Record<string, string | number>) => string): { title: string; detail?: string } {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  switch (event.kind) {
    case "created":
      return { title: t("tracker.event.created") };
    case "status_changed":
      return { title: t("tracker.event.statusChangedTitle"), detail: `${payload.fromStatus ?? ""} → ${payload.toStatus ?? ""}` };
    case "priority_changed":
      return { title: t("tracker.event.priorityChangedTitle"), detail: `${payload.from ?? ""} → ${payload.to ?? ""}` };
    case "due_changed":
      return { title: t("tracker.event.dueChanged") };
    case "assignee_changed":
      return { title: t("tracker.event.assigneeChangedTitle"), detail: String(payload.to ?? "—") };
    case "customer_changed":
      return { title: t("tracker.event.customerChangedTitle"), detail: String(payload.to ?? "—") };
    case "project_changed":
      return { title: t("tracker.event.projectChanged") };
    case "completed_at_changed":
      return { title: t("tracker.event.completedAtChanged") };
    case "title_changed":
      return { title: t("tracker.event.titleChangedTitle"), detail: String(payload.to ?? "") };
    case "file_added":
      return { title: t("tracker.event.fileAddedTitle"), detail: String(payload.fileName ?? "") };
    case "file_removed":
      return { title: t("tracker.event.fileRemovedTitle"), detail: String(payload.fileName ?? "") };
    case "local_file_added":
      return { title: t("tracker.event.localFileAddedTitle"), detail: String(payload.fileName ?? "") };
    case "local_file_removed":
      return { title: t("tracker.event.localFileRemovedTitle"), detail: String(payload.fileName ?? "") };
    case "file_pin_changed":
      return {
        title: t(payload.alwaysLatest ? "tracker.event.filePinnedToLatestTitle" : "tracker.event.filePinnedToVersionTitle"),
        detail: String(payload.fileName ?? ""),
      };
    case "file_version_updated":
      return {
        title: String(payload.fileName ?? t("tracker.event.fileVersionUpdatedTitle")),
        detail: t("tracker.event.versionArrow", { from: String(payload.fromVersion ?? "?"), to: String(payload.toVersion ?? "?") }),
      };
    case "archived":
      return { title: t("tracker.event.archived") };
    case "unarchived":
      return { title: t("tracker.event.unarchived") };
    case "pinned":
      return { title: t("tracker.event.pinned") };
    case "unpinned":
      return { title: t("tracker.event.unpinned") };
    case "duplicated":
      return { title: t("tracker.event.duplicatedTitle"), detail: String(payload.sourceTitle ?? "") };
    case "comment":
      return { title: t("tracker.event.commentTitle"), detail: String(payload.text ?? "") };
    default:
      return { title: event.kind };
  }
}

function HistoryEntry({ event, isLast }: { event: TrackerTaskEvent; isLast: boolean }) {
  const { t, locale } = useLanguage();
  const isComment = event.kind === "comment";
  const { title, detail } = useMemo(() => eventText(event, t), [event, t]);

  return (
    <div className="relative flex gap-2.5 pb-4 last:pb-0">
      {!isLast && <span className="absolute left-[4.5px] top-[14px] bottom-0 w-px bg-surface-border" />}
      <span className={`relative z-10 mt-1 h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-surface-modal ${isComment ? "bg-accent" : "bg-label-tertiary/60"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-label-tertiary">{formatEventTime(event.createdAt, locale)}</p>
        <p className={`mt-0.5 text-[12px] leading-snug ${isComment ? "font-medium text-label-primary" : "text-label-secondary"}`}>{title}</p>
        {detail && (
          <p className={`mt-0.5 text-[11.5px] leading-relaxed ${isComment ? "text-label-secondary" : "text-label-tertiary"}`}>{detail}</p>
        )}
      </div>
    </div>
  );
}
