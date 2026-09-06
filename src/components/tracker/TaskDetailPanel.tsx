import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileText,
  FolderClosed,
  Link2,
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
import { PriorityBadge, StatusPill, LabelChip, formatEventTime } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerFields, useTrackerLabels, useTrackerSettings, useTrackerStatuses, useTrackerTaskDetail } from "@/hooks/useTracker";
import {
  ApiError,
  attachTrackerTaskFile,
  addTrackerTaskComment,
  deleteTrackerTask,
  detachTrackerTaskFile,
  moveTrackerTask,
  openVersion,
  setTrackerTaskArchived,
  setTrackerTaskFieldValues,
  setTrackerTaskLabels,
  setTrackerTaskPinned,
  updateTrackerTask,
} from "@/services/api";
import type { Priority, TrackerTaskFile, TrackerTaskUpdateInput } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleted: () => void;
}

const inputClass =
  "w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content dark:bg-white/[0.05]";
const labelClass = "text-[11px] font-medium uppercase tracking-wide text-label-tertiary";

export function TaskDetailPanel({ taskId, onClose, onChanged, onOpenProject, onDeleted }: TaskDetailPanelProps) {
  const { t, locale, translateError } = useLanguage();
  const { showToast } = useToast();
  const { detail, refresh } = useTrackerTaskDetail(taskId);
  const { statuses } = useTrackerStatuses(detail?.boardId ?? null);
  const { fields } = useTrackerFields(detail?.boardId ?? null);
  const { labels } = useTrackerLabels(detail?.boardId ?? null);
  const { settings } = useTrackerSettings();

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

  function handleCopyLink() {
    navigator.clipboard?.writeText(`noxera-task://${taskId}`).then(
      () => showToast({ title: t("tracker.linkCopied") }),
      () => {},
    );
  }

  const currentStatus = statuses.find((s) => s.id === detail.statusId);

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="animate-scale-in flex h-[85vh] w-[720px] max-w-[95vw] flex-col rounded-apple-lg border border-surface-border bg-surface-modal shadow-modal backdrop-blur-apple" onMouseDown={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== detail.title && patch({ title: title.trim() })}
                className="w-full bg-transparent text-[17px] font-semibold text-label-primary outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={detail.statusId} onChange={(e) => handleStatusChange(e.target.value)} className="rounded-full border border-surface-border bg-transparent px-2 py-0.5 text-[11.5px] text-label-primary outline-none">
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select value={detail.priority} onChange={(e) => patch({ priority: e.target.value as Priority })} className="rounded-full border border-surface-border bg-transparent px-2 py-0.5 text-[11.5px] text-label-primary outline-none">
                  <option value="low">{t("tracker.priority.low")}</option>
                  <option value="normal">{t("tracker.priority.normal")}</option>
                  <option value="high">{t("tracker.priority.high")}</option>
                  <option value="critical">{t("tracker.priority.critical")}</option>
                </select>
                {currentStatus?.isDone && <StatusPill name={currentStatus.name} color={currentStatus.color} />}
                {detail.projectName && detail.projectId && (
                  <button
                    onClick={() => onOpenProject(detail.projectId!)}
                    className="flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11.5px] text-label-primary hover:bg-accent hover:text-white dark:bg-white/[0.08]"
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
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className={labelClass}>{t("tracker.fieldDescription")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => description !== (detail.description ?? "") && patch({ description: description.trim() || null })}
                  rows={4}
                  placeholder={t("tracker.descriptionPlaceholder")}
                  className="mt-1 w-full resize-y rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] leading-relaxed text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 focus:bg-surface-content dark:bg-white/[0.05]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>{t("tracker.fieldReceivedAt")}</label>
                  <input type="date" value={detail.receivedAt.slice(0, 10)} onChange={(e) => patch({ receivedAt: e.target.value })} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>{t("tracker.fieldDueAt")}</label>
                  <input type="date" value={detail.dueAt?.slice(0, 10) ?? ""} onChange={(e) => patch({ dueAt: e.target.value || null })} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>{t("tracker.fieldCompletedAt")}</label>
                  <div className="mt-1 flex gap-1">
                    <input type="date" value={detail.completedAt?.slice(0, 10) ?? ""} onChange={(e) => patch({ completedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("tracker.fieldCustomer")}</label>
                  <input defaultValue={detail.customer ?? ""} key={`customer-${detail.id}`} onBlur={(e) => e.target.value !== (detail.customer ?? "") && patch({ customer: e.target.value.trim() || null })} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>{t("tracker.fieldAssignee")}</label>
                  <input defaultValue={detail.assignee ?? ""} key={`assignee-${detail.id}`} onBlur={(e) => e.target.value !== (detail.assignee ?? "") && patch({ assignee: e.target.value.trim() || null })} className={`mt-1 ${inputClass}`} />
                </div>
              </div>

              {fields.length > 0 && (
                <div>
                  <label className={labelClass}>{t("tracker.customFields")}</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-3">
                    {fields.map((field) => {
                      const value = fieldValueMap.get(field.id) ?? "";
                      if (field.fieldType === "select") {
                        return (
                          <div key={field.id}>
                            <label className="text-[11px] text-label-secondary">{field.name}</label>
                            <select defaultValue={value} key={`${field.id}-${detail.id}`} onChange={(e) => handleFieldValue(field.id, e.target.value)} className={`mt-1 ${inputClass}`}>
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
                          <label key={field.id} className="flex items-center gap-2 pt-4">
                            <input type="checkbox" defaultChecked={value === "true"} key={`${field.id}-${detail.id}`} onChange={(e) => handleFieldValue(field.id, e.target.checked ? "true" : "false")} className="accent-accent" />
                            <span className="text-[12.5px] text-label-primary">{field.name}</span>
                          </label>
                        );
                      }
                      const type = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "datetime" ? "datetime-local" : field.fieldType === "url" ? "url" : "text";
                      return (
                        <div key={field.id}>
                          <label className="text-[11px] text-label-secondary">{field.name}</label>
                          <input type={type} defaultValue={value} key={`${field.id}-${detail.id}`} onBlur={(e) => handleFieldValue(field.id, e.target.value)} className={`mt-1 ${inputClass}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {labels.length > 0 && (
                <div>
                  <label className={labelClass}>{t("tracker.labels")}</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
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

              {/* Quick actions */}
              <div className="flex flex-wrap gap-1.5 border-t border-surface-border pt-3.5">
                <Button size="sm" variant="secondary" onClick={() => setDuplicateOpen(true)}>
                  <Copy size={13} />
                  {t("tracker.duplicate")}
                </Button>
                <Button size="sm" variant="secondary" onClick={handleToggleArchive}>
                  {detail.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  {t(detail.archived ? "tracker.unarchive" : "tracker.archive")}
                </Button>
                <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                  <Link2 size={13} />
                  {t("tracker.copyLink")}
                </Button>
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={13} />
                  {t("common.delete")}
                </Button>
              </div>
            </div>

            {/* Sidebar: files + history */}
            <div className="flex w-72 shrink-0 flex-col border-l border-surface-border">
              <div className="flex shrink-0 border-b border-surface-border">
                <button onClick={() => setTab("files")} className={`flex-1 py-2 text-[12px] font-medium ${tab === "files" ? "border-b-2 border-accent text-accent" : "text-label-secondary"}`}>
                  {t("tracker.tabFiles")} {detail.files.length > 0 && `(${detail.files.length})`}
                </button>
                <button onClick={() => setTab("history")} className={`flex-1 py-2 text-[12px] font-medium ${tab === "history" ? "border-b-2 border-accent text-accent" : "text-label-secondary"}`}>
                  {t("tracker.tabHistory")}
                </button>
              </div>

              {tab === "files" ? (
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {detail.files.map((f) => (
                    <div key={f.id} className="rounded-apple border border-surface-border p-2">
                      <div className="flex items-start gap-1.5">
                        <FileText size={14} className="mt-0.5 shrink-0 text-label-secondary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-label-primary">{f.fileName}</p>
                          {f.projectName && <p className="truncate text-[10.5px] text-label-tertiary">{f.projectName}</p>}
                        </div>
                        <button onClick={() => handleRemoveFile(f)} title={t("tracker.removeFile")} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary hover:bg-danger/10 hover:text-danger">
                          <X size={12} />
                        </button>
                      </div>
                      {!f.fileExists ? (
                        <p className="mt-1.5 text-[11px] text-danger">{t("tracker.fileGone")}</p>
                      ) : !f.versionExists ? (
                        <p className="mt-1.5 text-[11px] text-danger">{t("tracker.versionGone")}</p>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-label-tertiary">
                          <span>v{f.versionNumber}</span>
                          {f.alwaysLatest && (
                            <span className="flex items-center gap-0.5 rounded-full bg-accent/[0.12] px-1 py-0.5 text-accent">
                              <RefreshCw size={9} />
                              {t("tracker.alwaysLatestShort")}
                            </span>
                          )}
                          {f.unseenUpdate && <span className="rounded-full bg-accent/[0.12] px-1 py-0.5 text-accent">{t("tracker.fileUpdated")}</span>}
                          {f.versionDate && <span>{formatFullDateTime(f.versionDate, locale)}</span>}
                          {f.fileSize != null && <span>{formatBytes(f.fileSize)}</span>}
                        </div>
                      )}
                      {f.fileExists && f.versionExists && (
                        <button onClick={() => handleOpenFile(f)} className="mt-1.5 flex items-center gap-1 text-[11px] text-accent hover:underline">
                          <ExternalLink size={11} />
                          {t("menu.open")}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-apple-sm border border-dashed border-surface-border py-2 text-[11.5px] text-label-secondary hover:border-accent/40 hover:text-accent"
                  >
                    <Plus size={13} />
                    {t("tracker.addFile")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
                    {detail.events.map((ev) => (
                      <HistoryEntry key={ev.id} event={ev} />
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-1.5 border-t border-surface-border p-2">
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      placeholder={t("tracker.commentPlaceholder")}
                      className="min-w-0 flex-1 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2 h-8 text-[12px] text-label-primary outline-none placeholder:text-label-tertiary dark:bg-white/[0.05]"
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

function HistoryEntry({ event }: { event: import("@/types").TrackerTaskEvent }) {
  const { t, locale } = useLanguage();
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const isComment = event.kind === "comment";

  const text = useMemo(() => {
    switch (event.kind) {
      case "created":
        return t("tracker.event.created");
      case "status_changed":
        return t("tracker.event.statusChanged", { from: String(payload.fromStatus ?? ""), to: String(payload.toStatus ?? "") });
      case "priority_changed":
        return t("tracker.event.priorityChanged", { from: String(payload.from ?? ""), to: String(payload.to ?? "") });
      case "due_changed":
        return t("tracker.event.dueChanged");
      case "assignee_changed":
        return t("tracker.event.assigneeChanged", { to: String(payload.to ?? "—") });
      case "customer_changed":
        return t("tracker.event.customerChanged", { to: String(payload.to ?? "—") });
      case "project_changed":
        return t("tracker.event.projectChanged");
      case "completed_at_changed":
        return t("tracker.event.completedAtChanged");
      case "title_changed":
        return t("tracker.event.titleChanged", { to: String(payload.to ?? "") });
      case "file_added":
        return t("tracker.event.fileAdded", { name: String(payload.fileName ?? "") });
      case "file_removed":
        return t("tracker.event.fileRemoved", { name: String(payload.fileName ?? "") });
      case "file_version_updated":
        return t("tracker.event.fileVersionUpdated", {
          name: String(payload.fileName ?? ""),
          from: String(payload.fromVersion ?? "?"),
          to: String(payload.toVersion ?? "?"),
        });
      case "archived":
        return t("tracker.event.archived");
      case "unarchived":
        return t("tracker.event.unarchived");
      case "pinned":
        return t("tracker.event.pinned");
      case "unpinned":
        return t("tracker.event.unpinned");
      case "duplicated":
        return t("tracker.event.duplicated", { from: String(payload.sourceTitle ?? "") });
      case "comment":
        return String(payload.text ?? "");
      default:
        return event.kind;
    }
  }, [event, payload, t]);

  return (
    <div className={`rounded-apple-sm px-2 py-1.5 text-[11.5px] ${isComment ? "bg-accent/[0.06]" : ""}`}>
      <p className={isComment ? "text-label-primary" : "text-label-secondary"}>
        {isComment && <MessageSquare size={10} className="mr-1 inline text-accent" />}
        {text}
      </p>
      <p className="mt-0.5 text-[10px] text-label-tertiary">{formatEventTime(event.createdAt, locale)}</p>
    </div>
  );
}
