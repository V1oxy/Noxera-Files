import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileText,
  FolderClosed,
  HardDrive,
  History,
  Link as LinkIcon,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { Select } from "@/components/Select";
import { CustomFieldInputs, fieldInputClass, fieldLabelClass } from "@/components/tracker/CustomFieldInputs";
import { DuplicateTaskModal } from "@/components/tracker/DuplicateTaskModal";
import { FilePickerModal, type FilePickerResult } from "@/components/tracker/FilePickerModal";
import { LinkPickerModal } from "@/components/tracker/LinkPickerModal";
import { LocalFileVersionHistoryModal } from "@/components/tracker/LocalFileVersionHistoryModal";
import { PinFileVersionModal } from "@/components/tracker/PinFileVersionModal";
import { LabelChip, formatEventTime } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerFields, useTrackerLabels, useTrackerPriorities, useTrackerStatuses, useTrackerTaskDetail } from "@/hooks/useTracker";
import {
  ApiError,
  addTrackerTaskAdhocLink,
  addTrackerTaskComment,
  addTrackerTaskLocalFile,
  addTrackerTaskLocalFileVersion,
  attachTrackerTaskFile,
  attachTrackerTaskLink,
  deleteTrackerTask,
  deleteTrackerTaskComment,
  detachTrackerTaskFile,
  detachTrackerTaskLink,
  openLink,
  openTrackerTaskLocalFile,
  openTrackerTaskLocalFileVersion,
  openVersion,
  pathIsDirectory,
  pickFilesToUpload,
  removeTrackerTaskLocalFile,
  restoreTrackerTaskLocalFileVersion,
  setTrackerTaskArchived,
  setTrackerTaskFieldValues,
  setTrackerTaskFilePin,
  setTrackerTaskLabels,
  setTrackerTaskPinned,
  updateTrackerTask,
  moveTrackerTask,
} from "@/services/api";
import type {
  Link,
  TrackerTaskEvent,
  TrackerTaskFile,
  TrackerTaskLink,
  TrackerTaskLocalFile,
  TrackerTaskLocalFileVersion,
  TrackerTaskUpdateInput,
} from "@/types";
import { formatBytes } from "@/utils/format";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleted: () => void;
}

const inputClass = fieldInputClass;
const labelClass = fieldLabelClass;
const fieldGroupClass = "space-y-1";

export function TaskDetailPanel({ taskId, onClose, onChanged, onOpenProject, onDeleted }: TaskDetailPanelProps) {
  const { t, translateError } = useLanguage();
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
  const [pinVersionTarget, setPinVersionTarget] = useState<TrackerTaskFile | null>(null);
  // Stored as an id (not the object itself) and re-resolved against `detail`
  // below on every render, so the modal always shows the version list as it
  // is right now - adding or restoring a version refreshes `detail`, and a
  // stale snapshot object would otherwise keep showing the list from before
  // that action.
  const [localFileHistoryId, setLocalFileHistoryId] = useState<string | null>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [adhocLinkFormOpen, setAdhocLinkFormOpen] = useState(false);
  const [adhocTitle, setAdhocTitle] = useState("");
  const [adhocUrl, setAdhocUrl] = useState("");
  const [tab, setTab] = useState<"files" | "links" | "comments" | "history">("files");
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (detail) {
      setTitle(detail.title);
      setDescription(detail.description ?? "");
    }
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // An OS-level drag from Finder/Explorer dropped anywhere on this modal
  // attaches the file(s) to the task the same way "add from computer" does -
  // this listener is window-wide, but TaskDetailPanel is only ever mounted
  // while it's the front-most modal (Sidebar/BoardKanban's own dnd-kit drags
  // can't be in progress at the same time - they're behind the backdrop).
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragActive(true);
      } else if (event.payload.type === "leave") {
        setIsDragActive(false);
      } else if (event.payload.type === "drop") {
        setIsDragActive(false);
        void handleDropPaths(event.payload.paths);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, localFileHistoryId]);

  async function handleDropPaths(paths: string[]) {
    if (paths.length === 0) return;
    const kinds = await Promise.all(paths.map((p) => pathIsDirectory(p).catch(() => false)));
    const filePaths = paths.filter((_, i) => !kinds[i]);
    if (filePaths.length === 0) return;

    // The version-history modal's own backdrop covers the whole window, so
    // a drop can never land on anything else while it's open - like the
    // file manager's own Version History, every drop while it's open is a
    // new version of that one file, not a new attachment.
    if (localFileHistoryId) {
      try {
        await addTrackerTaskLocalFileVersion(localFileHistoryId, filePaths[0]);
        await refresh();
        onChanged();
      } catch (e) {
        showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
      }
      return;
    }

    let succeeded = 0;
    for (const p of filePaths) {
      try {
        await addTrackerTaskLocalFile(taskId, p);
        succeeded++;
      } catch {
        // continue with the rest of the batch
      }
    }
    if (succeeded > 0) {
      await refresh();
      onChanged();
    }
  }

  const fieldValueMap = useMemo(() => {
    const map = new Map<string, string | null>();
    detail?.fieldValues.forEach((fv) => map.set(fv.fieldId, fv.value));
    return map;
  }, [detail?.fieldValues]);

  // Custom fields need a *controlled* display value (so a keystroke is never
  // silently dropped if blur doesn't fire before something else steals focus
  // - see handleRequestClose's own note on that below) that's still only
  // persisted to the backend on commit, not on every keystroke - this local
  // draft is that display value, reset from the server copy whenever the
  // task itself changes (not on every field-value refetch, which would
  // otherwise stomp whatever the user is mid-typing in a sibling field).
  const [fieldDraft, setFieldDraft] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    setFieldDraft(new Map(fieldValueMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  // Comments are stored alongside automatic events in one log (so the
  // backend never has to reconcile two separate timelines), but shown in
  // their own tab - History stays a pure technical audit trail.
  const commentEvents = useMemo(() => detail?.events.filter((ev) => ev.kind === "comment") ?? [], [detail?.events]);
  const historyEvents = useMemo(() => detail?.events.filter((ev) => ev.kind !== "comment") ?? [], [detail?.events]);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<TrackerTaskEvent | null>(null);

  if (!detail) return null;

  const localFileHistoryTarget = detail.localFiles.find((lf) => lf.id === localFileHistoryId) ?? null;

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
    try {
      await moveTrackerTask(taskId, statusId, [taskId]);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleFieldValue(fieldId: string, value: string) {
    try {
      const next = detail!.fieldValues.filter((fv) => fv.fieldId !== fieldId);
      next.push({ fieldId, value: value || null });
      await setTrackerTaskFieldValues(taskId, next);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleLabelToggle(labelId: string) {
    try {
      const has = detail!.labelIds.includes(labelId);
      const next = has ? detail!.labelIds.filter((id) => id !== labelId) : [...detail!.labelIds, labelId];
      await setTrackerTaskLabels(taskId, next);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddFile(result: FilePickerResult) {
    try {
      await attachTrackerTaskFile(taskId, {
        fileId: result.file.id,
        versionId: result.alwaysLatest ? undefined : result.versionId,
        alwaysLatest: result.alwaysLatest,
      });
      setPickerOpen(false);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleRemoveFile(taskFile: TrackerTaskFile) {
    try {
      await detachTrackerTaskFile(taskFile.id);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleOpenFile(taskFile: TrackerTaskFile) {
    if (!taskFile.versionExists || !taskFile.versionId) return;
    try {
      await openVersion(taskFile.versionId);
    } catch (e) {
      showToast({ title: t("toast.openFileError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  // Switching back to "always latest" is a simple, easily-reversible toggle
  // - no confirmation needed. Pinning *to* a fixed version goes through
  // pinVersionTarget instead (see below): it's the direction that benefits
  // from a confirmation and a choice of which version, since it silently
  // defaulting to "whatever's current right now" is exactly what surprised
  // people (spec: "дать выбор какую версию мы фиксируем").
  async function handleSwitchToLatest(taskFile: TrackerTaskFile) {
    try {
      await setTrackerTaskFilePin(taskFile.id, true);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleConfirmPinVersion(versionId: string) {
    if (!pinVersionTarget) return;
    await setTrackerTaskFilePin(pinVersionTarget.id, false, versionId);
    setPinVersionTarget(null);
    await refresh();
    onChanged();
  }

  async function handleAddLocalFiles() {
    const paths = await pickFilesToUpload(true);
    if (paths.length === 0) return;
    try {
      for (const path of paths) {
        await addTrackerTaskLocalFile(taskId, path);
      }
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleRemoveLocalFile(localFile: TrackerTaskLocalFile) {
    try {
      await removeTrackerTaskLocalFile(localFile.id);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleOpenLocalFile(localFile: TrackerTaskLocalFile) {
    try {
      await openTrackerTaskLocalFile(localFile.id);
    } catch (e) {
      showToast({ title: t("toast.openFileError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddLocalFileVersion(localFile: TrackerTaskLocalFile) {
    const paths = await pickFilesToUpload(false);
    if (paths.length === 0) return;
    try {
      await addTrackerTaskLocalFileVersion(localFile.id, paths[0]);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleRestoreLocalFileVersion(localFile: TrackerTaskLocalFile, version: TrackerTaskLocalFileVersion) {
    await restoreTrackerTaskLocalFileVersion(localFile.id, version.id);
    await refresh();
    onChanged();
  }

  async function handleOpenLocalFileVersion(version: TrackerTaskLocalFileVersion) {
    try {
      await openTrackerTaskLocalFileVersion(version.id);
    } catch (e) {
      showToast({ title: t("toast.openFileError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAttachLink(link: Link) {
    setLinkPickerOpen(false);
    try {
      await attachTrackerTaskLink(taskId, link.id);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddAdhocLink() {
    if (!adhocTitle.trim() || !adhocUrl.trim()) return;
    try {
      await addTrackerTaskAdhocLink(taskId, adhocTitle.trim(), adhocUrl.trim());
      setAdhocTitle("");
      setAdhocUrl("");
      setAdhocLinkFormOpen(false);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleRemoveTaskLink(link: TrackerTaskLink) {
    try {
      await detachTrackerTaskLink(link.id);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleOpenTaskLink(link: TrackerTaskLink) {
    try {
      await openLink(link.url);
    } catch (e) {
      showToast({ title: t("links.openError"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    try {
      await addTrackerTaskComment(taskId, comment.trim());
      setComment("");
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleTogglePin() {
    try {
      await setTrackerTaskPinned(taskId, !detail!.pinned);
      await refresh();
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleToggleArchive() {
    try {
      await setTrackerTaskArchived(taskId, !detail!.archived);
      await refresh();
      onChanged();
      showToast({ title: detail!.archived ? t("tracker.restoredFromArchive") : t("tracker.archived") });
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleDelete() {
    await deleteTrackerTask(taskId);
    onDeleted();
  }

  async function handleDeleteComment() {
    if (!deleteCommentTarget) return;
    try {
      await deleteTrackerTaskComment(deleteCommentTarget.id);
      setDeleteCommentTarget(null);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  // Clicking the backdrop fires this on mousedown, before the still-focused
  // title/description field's own onBlur has a chance to save - closing
  // straight to onClose() would silently drop whatever was just typed, so
  // flush both fields here first regardless of whether blur already fired
  // (patch() no-ops when nothing actually changed).
  function handleRequestClose() {
    if (title.trim() && title !== detail!.title) void patch({ title: title.trim() });
    if (description !== (detail!.description ?? "")) void patch({ description: description.trim() || null });
    onClose();
  }

  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const priorityOptions = priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }));

  return (
    <>
      {/* `no-drag` here (and on the panel below) matters more than it does on
          most overlays: this modal centers itself over whichever page opened
          it, which routinely puts its header - the task title input first
          among them - right on top of that page's own `drag-region` toolbar.
          Without an explicit override the window reads a click-drag meant to
          select/copy the title as a titlebar drag and moves itself instead. */}
      <div className="no-drag fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && handleRequestClose()}>
        <div className="animate-scale-in relative flex h-[82vh] w-[830px] max-w-[95vw] flex-col rounded-apple-lg border border-surface-border bg-surface-modal shadow-modal backdrop-blur-apple" onMouseDown={(e) => e.stopPropagation()}>
          {isDragActive && !localFileHistoryId && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-apple-lg border-2 border-dashed border-accent bg-accent/[0.08] backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 text-accent">
                <HardDrive size={28} />
                <p className="text-[13px] font-medium">{t("tracker.dropFilesToAttach")}</p>
              </div>
            </div>
          )}
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
                <Select variant="pill" value={detail.statusId} onChange={handleStatusChange} options={statusOptions} />
                <Select variant="pill" value={detail.priorityId} onChange={(v) => patch({ priorityId: v })} options={priorityOptions} />
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
              <button onClick={handleRequestClose} className="rounded-apple-sm p-1.5 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]">
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

                <CustomFieldInputs
                  fields={fields}
                  values={fieldDraft}
                  onChange={(fieldId, value) => setFieldDraft((prev) => new Map(prev).set(fieldId, value))}
                  onCommit={handleFieldValue}
                />

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
            <div className="flex w-96 shrink-0 flex-col border-l border-surface-border bg-black/[0.012] dark:bg-white/[0.015]">
              <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-surface-border px-4 pt-3">
                <button onClick={() => setTab("files")} className={`relative shrink-0 pb-2.5 text-[12px] font-medium transition-colors ${tab === "files" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
                  {t("tracker.tabFiles")} {detail.files.length + detail.localFiles.length > 0 && `(${detail.files.length + detail.localFiles.length})`}
                  {tab === "files" && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
                <button onClick={() => setTab("links")} className={`relative shrink-0 pb-2.5 text-[12px] font-medium transition-colors ${tab === "links" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
                  {t("tracker.tabLinks")} {detail.links.length > 0 && `(${detail.links.length})`}
                  {tab === "links" && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
                <button onClick={() => setTab("comments")} className={`relative shrink-0 pb-2.5 text-[12px] font-medium transition-colors ${tab === "comments" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
                  {t("tracker.tabComments")} {commentEvents.length > 0 && `(${commentEvents.length})`}
                  {tab === "comments" && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent" />}
                </button>
                <button onClick={() => setTab("history")} className={`relative shrink-0 pb-2.5 text-[12px] font-medium transition-colors ${tab === "history" ? "text-accent" : "text-label-secondary hover:text-label-primary"}`}>
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
                                onClick={() => (f.alwaysLatest ? setPinVersionTarget(f) : handleSwitchToLatest(f))}
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
                  {detail.localFiles.map((lf) => {
                    const currentVersion = lf.versions.find((v) => v.id === lf.currentVersionId);
                    return (
                      <div key={lf.id} className="group rounded-apple border border-surface-border bg-surface-card p-2.5 shadow-card">
                        <div className="flex items-start gap-2">
                          <HardDrive size={15} className="mt-0.5 shrink-0 text-label-secondary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-label-primary">{lf.fileName}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-label-secondary">
                              {currentVersion && <span className="font-medium">v{currentVersion.versionNumber}</span>}
                              <span className="text-label-tertiary">·</span>
                              <span className="text-label-tertiary">{formatBytes(lf.fileSize)}</span>
                              <span className="text-label-tertiary">·</span>
                              <span className="text-label-tertiary">{t("tracker.localFileBadge")}</span>
                            </p>
                          </div>
                          <button onClick={() => handleRemoveLocalFile(lf)} title={t("tracker.removeFile")} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <button onClick={() => handleOpenLocalFile(lf)} className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                            <ExternalLink size={11} />
                            {t("menu.open")}
                          </button>
                          <button onClick={() => setLocalFileHistoryId(lf.id)} className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                            <History size={11} />
                            {t("menu.versionHistory")} ({lf.versionCount})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-1.5">
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
              ) : tab === "links" ? (
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {detail.links.map((link) => (
                    <div key={link.id} className="group rounded-apple border border-surface-border bg-surface-card p-2.5 shadow-card">
                      <div className="flex items-start gap-2">
                        <LinkIcon size={15} className="mt-0.5 shrink-0 text-label-secondary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-label-primary">{link.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-label-secondary">{link.url}</p>
                          {!link.linkExists && <p className="mt-1 text-[11px] text-danger">{t("tracker.linkGone")}</p>}
                        </div>
                        <button onClick={() => handleRemoveTaskLink(link)} title={t("tracker.removeFile")} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
                          <X size={12} />
                        </button>
                      </div>
                      <button onClick={() => handleOpenTaskLink(link)} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                        <ExternalLink size={11} />
                        {t("menu.open")}
                      </button>
                    </div>
                  ))}

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
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setLinkPickerOpen(true)}
                        className="flex items-center justify-center gap-1.5 rounded-apple-sm border border-dashed border-surface-border py-2 text-[11.5px] text-label-secondary transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        <LinkIcon size={13} />
                        {t("tracker.attachFromLinks")}
                      </button>
                      <button
                        onClick={() => setAdhocLinkFormOpen(true)}
                        className="flex items-center justify-center gap-1.5 rounded-apple-sm border border-dashed border-surface-border py-2 text-[11.5px] text-label-secondary transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        <Plus size={13} />
                        {t("tracker.addPlainLink")}
                      </button>
                    </div>
                  )}
                </div>
              ) : tab === "comments" ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {commentEvents.length === 0 && (
                      <p className="px-1 py-4 text-center text-[12px] text-label-tertiary">{t("tracker.noCommentsYet")}</p>
                    )}
                    {commentEvents.map((ev, i) => (
                      <CommentEntry key={ev.id} event={ev} isLast={i === commentEvents.length - 1} onDelete={() => setDeleteCommentTarget(ev)} />
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
              ) : (
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {historyEvents.length === 0 && (
                    <p className="px-1 py-4 text-center text-[12px] text-label-tertiary">{t("tracker.noHistoryYet")}</p>
                  )}
                  {historyEvents.map((ev, i) => (
                    <HistoryEntry key={ev.id} event={ev} isLast={i === historyEvents.length - 1} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilePickerModal open={pickerOpen} onCancel={() => setPickerOpen(false)} onConfirm={handleAddFile} />

      <PinFileVersionModal
        open={pinVersionTarget !== null}
        taskFile={pinVersionTarget}
        onCancel={() => setPinVersionTarget(null)}
        onConfirm={handleConfirmPinVersion}
      />

      <LocalFileVersionHistoryModal
        open={localFileHistoryTarget !== null}
        localFile={localFileHistoryTarget}
        isDragActive={isDragActive}
        onClose={() => setLocalFileHistoryId(null)}
        onView={handleOpenLocalFileVersion}
        onRestore={(version) => (localFileHistoryTarget ? handleRestoreLocalFileVersion(localFileHistoryTarget, version) : Promise.resolve())}
        onAddVersion={() => localFileHistoryTarget && handleAddLocalFileVersion(localFileHistoryTarget)}
      />

      <LinkPickerModal open={linkPickerOpen} onCancel={() => setLinkPickerOpen(false)} onConfirm={handleAttachLink} />

      <DeleteModal
        open={deleteOpen}
        title={t("tracker.deleteTaskTitle")}
        message={t("tracker.deleteTaskMessage")}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <DuplicateTaskModal open={duplicateOpen} taskId={taskId} onCancel={() => setDuplicateOpen(false)} onDuplicated={() => { setDuplicateOpen(false); onChanged(); }} />

      <DeleteModal
        open={deleteCommentTarget !== null}
        title={t("tracker.deleteCommentTitle")}
        message={t("tracker.deleteCommentMessage")}
        onCancel={() => setDeleteCommentTarget(null)}
        onConfirm={handleDeleteComment}
      />
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
    case "local_file_version_added":
      return { title: t("tracker.event.localFileVersionAddedTitle"), detail: `${String(payload.fileName ?? "")} · v${String(payload.versionNumber ?? "")}` };
    case "local_file_version_restored":
      return { title: t("tracker.event.localFileVersionRestoredTitle"), detail: `${String(payload.fileName ?? "")} · v${String(payload.versionNumber ?? "")}` };
    case "link_added":
      return { title: t("tracker.event.linkAddedTitle"), detail: String(payload.title ?? "") };
    case "link_removed":
      return { title: t("tracker.event.linkRemovedTitle"), detail: String(payload.title ?? "") };
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
    case "description_changed":
      return { title: t("tracker.event.descriptionChanged") };
    case "received_at_changed":
      return { title: t("tracker.event.receivedAtChangedTitle"), detail: t("tracker.event.dateArrow", { from: formatEventDate(payload.from), to: formatEventDate(payload.to) }) };
    case "label_added":
      return { title: t("tracker.event.labelAddedTitle"), detail: String(payload.labelName ?? "") };
    case "label_removed":
      return { title: t("tracker.event.labelRemovedTitle"), detail: String(payload.labelName ?? "") };
    case "field_value_changed":
      return {
        title: t("tracker.event.fieldValueChangedTitle", { name: String(payload.fieldName ?? "") }),
        detail: `${payload.from ?? t("tracker.event.emptyValue")} → ${payload.to ?? t("tracker.event.emptyValue")}`,
      };
    case "comment_deleted":
      return { title: t("tracker.event.commentDeletedTitle"), detail: String(payload.text ?? "") };
    default:
      return { title: event.kind };
  }
}

function formatEventDate(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  return s ? s.slice(0, 10) : "—";
}

function CommentEntry({ event, isLast, onDelete }: { event: TrackerTaskEvent; isLast: boolean; onDelete: () => void }) {
  const { t, locale } = useLanguage();
  const text = String((event.payload as Record<string, unknown> | null)?.text ?? "");

  return (
    <div className={`group rounded-apple border border-surface-border bg-surface-card p-2.5 shadow-card ${isLast ? "" : "mb-2"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] text-label-tertiary">{formatEventTime(event.createdAt, locale)}</p>
        <button
          onClick={onDelete}
          title={t("tracker.deleteComment")}
          className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-label-primary">{text}</p>
    </div>
  );
}

function HistoryEntry({ event, isLast }: { event: TrackerTaskEvent; isLast: boolean }) {
  const { t, locale } = useLanguage();
  const { title, detail } = useMemo(() => eventText(event, t), [event, t]);

  return (
    <div className="relative flex gap-2.5 pb-4 last:pb-0">
      {!isLast && <span className="absolute left-[4.5px] top-[14px] bottom-0 w-px bg-surface-border" />}
      <span className="relative z-10 mt-1 h-[9px] w-[9px] shrink-0 rounded-full bg-label-tertiary/60 ring-2 ring-surface-modal" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-label-tertiary">{formatEventTime(event.createdAt, locale)}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-label-secondary">{title}</p>
        {detail && <p className="mt-0.5 text-[11.5px] leading-relaxed text-label-tertiary">{detail}</p>}
      </div>
    </div>
  );
}
