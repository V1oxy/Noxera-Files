import { Archive, ArrowDown, ArrowUp, ChevronRight, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { Modal, ModalBody, ModalHeader } from "@/components/Modal";
import { Select } from "@/components/Select";
import { fieldInputClass, fieldLabelClass } from "@/components/tracker/CustomFieldInputs";
import { ColorSwatchButton, TRACKER_COLORS as COLORS } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerFields, useTrackerLabels, useTrackerPriorities, useTrackerStatuses } from "@/hooks/useTracker";
import {
  ApiError,
  createTrackerField,
  createTrackerLabel,
  createTrackerPriority,
  createTrackerStatus,
  deleteTrackerBoard,
  deleteTrackerField,
  deleteTrackerLabel,
  deleteTrackerPriority,
  deleteTrackerStatus,
  renameTrackerFieldOption,
  reorderTrackerFields,
  reorderTrackerLabels,
  reorderTrackerPriorities,
  reorderTrackerStatuses,
  setTrackerBoardCardSize,
  setTrackerPriorityDefault,
  setTrackerStatusDefault,
  setTrackerStatusIsDone,
  updateTrackerBoard,
  updateTrackerField,
  updateTrackerLabel,
  updateTrackerPriority,
  updateTrackerStatus,
} from "@/services/api";
import type { CardSize, TrackerBoard, TrackerField, TrackerFieldType, TrackerLabel, TrackerPriority, TrackerStatus } from "@/types";

interface BoardSettingsModalProps {
  open: boolean;
  board: TrackerBoard;
  onClose: () => void;
  onBoardChanged: () => void;
  onBoardDeleted: () => void;
}

type Tab = "general" | "statuses" | "priorities" | "fields" | "labels";

/** Swatch buttons in the "create new" row (picking a color before anything
 * exists yet to attach ColorSwatchButton's edit popover to). */
const newSwatchClass = "h-6 w-6 shrink-0 rounded-full border border-black/10";

export function BoardSettingsModal({ open, board, onClose, onBoardChanged, onBoardDeleted }: BoardSettingsModalProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("general");

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <ModalHeader title={t("tracker.boardSettingsTitle", { name: board.name })} />
      <div className="flex gap-1 border-b border-surface-border px-5">
        {(["general", "statuses", "priorities", "fields", "labels"] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-2 py-2 text-[12.5px] font-medium ${tab === tb ? "border-b-2 border-accent text-accent" : "text-label-secondary"}`}
          >
            {t(`tracker.boardSettingsTab.${tb}`)}
          </button>
        ))}
      </div>
      <ModalBody>
        {/* Every tab stays mounted (just hidden) instead of being swapped in
            and out - each one fetches its own data on mount, so unmounting
            it on every tab switch meant re-fetching from scratch every time,
            flashing empty before the list popped back in. */}
        <div className="max-h-[55vh] overflow-y-auto">
          <div className={tab === "general" ? "" : "hidden"}>
            <GeneralTab board={board} onBoardChanged={onBoardChanged} onBoardDeleted={onBoardDeleted} onClose={onClose} />
          </div>
          <div className={tab === "statuses" ? "" : "hidden"}>
            <StatusesTab boardId={board.id} />
          </div>
          <div className={tab === "priorities" ? "" : "hidden"}>
            <PrioritiesTab boardId={board.id} />
          </div>
          <div className={tab === "fields" ? "" : "hidden"}>
            <FieldsTab boardId={board.id} />
          </div>
          <div className={tab === "labels" ? "" : "hidden"}>
            <LabelsTab boardId={board.id} />
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

function GeneralTab({
  board,
  onBoardChanged,
  onBoardDeleted,
  onClose,
}: {
  board: TrackerBoard;
  onBoardChanged: () => void;
  onBoardDeleted: () => void;
  onClose: () => void;
}) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [cardSize, setCardSize] = useState<CardSize>(board.cardSize);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateTrackerBoard(board.id, { name: name.trim(), description: description.trim() || null });
      if (cardSize !== board.cardSize) await setTrackerBoardCardSize(board.id, cardSize);
      onBoardChanged();
      showToast({ title: t("tracker.boardUpdated") });
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    await deleteTrackerBoard(board.id);
    onBoardDeleted();
    onClose();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("tracker.boardName")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 dark:bg-white/[0.05]" />
      </div>
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("project.description")}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] text-label-primary outline-none focus:border-accent/50 dark:bg-white/[0.05]" />
      </div>
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-label-tertiary">{t("tracker.cardSize")}</label>
        <div className="mt-1 flex gap-2">
          {(["normal", "compact"] as CardSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setCardSize(size)}
              className={`rounded-apple-sm border px-3 py-1.5 text-[12.5px] ${cardSize === size ? "border-accent bg-accent/[0.08] text-accent" : "border-surface-border text-label-primary"}`}
            >
              {t(`tracker.cardSize.${size}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-surface-border pt-3">
        <Button variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={13} />
          {t("tracker.deleteBoard")}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={busy}>
          {t("common.save")}
        </Button>
      </div>

      <DeleteModal
        open={deleteOpen}
        title={t("tracker.deleteBoardTitle")}
        message={t("tracker.deleteBoardMessage")}
        confirmValue={board.name}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatusesTab({ boardId }: { boardId: string }) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const { statuses, refresh } = useTrackerStatuses(boardId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [reassignTarget, setReassignTarget] = useState<TrackerStatus | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    await createTrackerStatus(boardId, { name: name.trim(), color, moveToArchive: false });
    setName("");
    await refresh();
  }

  async function handleReorder(index: number, dir: -1 | 1) {
    const next = [...statuses];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderTrackerStatuses(next.map((s) => s.id));
    await refresh();
  }

  async function handleColorChange(status: TrackerStatus, color: string) {
    await updateTrackerStatus(status.id, { name: status.name, color, moveToArchive: status.moveToArchive });
    await refresh();
  }

  async function handleToggleMoveToArchive(status: TrackerStatus, moveToArchive: boolean) {
    await updateTrackerStatus(status.id, { name: status.name, color: status.color, moveToArchive });
    await refresh();
  }

  async function handleDelete(status: TrackerStatus) {
    if (status.taskCount > 0) {
      setReassignTarget(status);
      setReassignTo(statuses.find((s) => s.id !== status.id)?.id ?? "");
      return;
    }
    try {
      await deleteTrackerStatus(status.id);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function confirmReassignDelete() {
    if (!reassignTarget || !reassignTo) return;
    try {
      await deleteTrackerStatus(reassignTarget.id, reassignTo);
      setReassignTarget(null);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  return (
    <div className="space-y-2">
      {statuses.map((status, i) => (
        <div key={status.id} className="space-y-1.5 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <div className="flex items-center gap-2">
            <ColorSwatchButton color={status.color} onChange={(c) => handleColorChange(status, c)} />
            <input
              defaultValue={status.name}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== status.name &&
                updateTrackerStatus(status.id, { name: e.target.value.trim(), color: status.color, moveToArchive: status.moveToArchive }).then(refresh)
              }
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none"
            />
            <span className="shrink-0 text-[10.5px] text-label-tertiary">{status.taskCount}</span>
            <button
              title={t("tracker.setDefaultStatus")}
              onClick={() => setTrackerStatusDefault(status.id).then(refresh)}
              className={`shrink-0 rounded-apple-sm p-1 ${status.isDefault ? "text-accent" : "text-label-tertiary hover:text-label-primary"}`}
            >
              <Star size={13} fill={status.isDefault ? "currentColor" : "none"} />
            </button>
            <button onClick={() => handleReorder(i, -1)} disabled={i === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
              <ArrowUp size={13} />
            </button>
            <button onClick={() => handleReorder(i, 1)} disabled={i === statuses.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
              <ArrowDown size={13} />
            </button>
            <button onClick={() => handleDelete(status)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-[22px]">
            <label className="flex shrink-0 items-center gap-1 text-[10.5px] text-label-tertiary">
              <input type="checkbox" checked={status.isDone} onChange={(e) => setTrackerStatusIsDone(status.id, e.target.checked).then(refresh)} className="accent-accent" />
              {t("tracker.isDoneStatus")}
            </label>
            <label className="flex shrink-0 items-center gap-1 text-[10.5px] text-label-tertiary" title={t("tracker.moveToArchiveHint")}>
              <input
                type="checkbox"
                checked={status.moveToArchive}
                onChange={(e) => handleToggleMoveToArchive(status, e.target.checked)}
                className="accent-accent"
              />
              <Archive size={11} />
              {t("tracker.moveToArchive")}
            </label>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 rounded-apple-sm border border-dashed border-surface-border px-2.5 py-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`${newSwatchClass} ${color === c ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("tracker.newStatusPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
        />
        <button onClick={handleAdd} className="shrink-0 rounded-apple-sm bg-accent p-1 text-white">
          <Plus size={13} />
        </button>
      </div>

      {reassignTarget && (
        <div className="rounded-apple border border-accent/40 bg-accent/[0.06] p-3">
          <p className="text-[12.5px] text-label-primary">{t("tracker.reassignPrompt", { count: reassignTarget.taskCount, name: reassignTarget.name })}</p>
          <Select
            className="mt-2 w-full"
            value={reassignTo}
            onChange={setReassignTo}
            options={statuses.filter((s) => s.id !== reassignTarget.id).map((s) => ({ value: s.id, label: s.name, color: s.color }))}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setReassignTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="danger" onClick={confirmReassignDelete}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrioritiesTab({ boardId }: { boardId: string }) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const { priorities, refresh } = useTrackerPriorities(boardId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [reassignTarget, setReassignTarget] = useState<TrackerPriority | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    await createTrackerPriority(boardId, { name: name.trim(), color });
    setName("");
    await refresh();
  }

  async function handleReorder(index: number, dir: -1 | 1) {
    const next = [...priorities];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderTrackerPriorities(next.map((p) => p.id));
    await refresh();
  }

  async function handleColorChange(priority: TrackerPriority, color: string) {
    await updateTrackerPriority(priority.id, { name: priority.name, color });
    await refresh();
  }

  async function handleDelete(priority: TrackerPriority) {
    if (priority.taskCount > 0) {
      setReassignTarget(priority);
      setReassignTo(priorities.find((p) => p.id !== priority.id)?.id ?? "");
      return;
    }
    try {
      await deleteTrackerPriority(priority.id);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function confirmReassignDelete() {
    if (!reassignTarget || !reassignTo) return;
    try {
      await deleteTrackerPriority(reassignTarget.id, reassignTo);
      setReassignTarget(null);
      await refresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  return (
    <div className="space-y-2">
      {priorities.map((priority, i) => (
        <div key={priority.id} className="flex items-center gap-2 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <ColorSwatchButton color={priority.color} onChange={(c) => handleColorChange(priority, c)} />
          <input
            defaultValue={priority.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== priority.name && updateTrackerPriority(priority.id, { name: e.target.value.trim(), color: priority.color }).then(refresh)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none"
          />
          <span className="shrink-0 text-[10.5px] text-label-tertiary">{priority.taskCount}</span>
          <button
            title={t("tracker.setDefaultPriority")}
            onClick={() => setTrackerPriorityDefault(priority.id).then(refresh)}
            className={`shrink-0 rounded-apple-sm p-1 ${priority.isDefault ? "text-accent" : "text-label-tertiary hover:text-label-primary"}`}
          >
            <Star size={13} fill={priority.isDefault ? "currentColor" : "none"} />
          </button>
          <button onClick={() => handleReorder(i, -1)} disabled={i === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => handleReorder(i, 1)} disabled={i === priorities.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button onClick={() => handleDelete(priority)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 rounded-apple-sm border border-dashed border-surface-border px-2.5 py-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`${newSwatchClass} ${color === c ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("tracker.newPriorityPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
        />
        <button onClick={handleAdd} className="shrink-0 rounded-apple-sm bg-accent p-1 text-white">
          <Plus size={13} />
        </button>
      </div>

      {reassignTarget && (
        <div className="rounded-apple border border-accent/40 bg-accent/[0.06] p-3">
          <p className="text-[12.5px] text-label-primary">{t("tracker.reassignPriorityPrompt", { count: reassignTarget.taskCount, name: reassignTarget.name })}</p>
          <Select
            className="mt-2 w-full"
            value={reassignTo}
            onChange={setReassignTo}
            options={priorities.filter((p) => p.id !== reassignTarget.id).map((p) => ({ value: p.id, label: p.name, color: p.color }))}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setReassignTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="danger" onClick={confirmReassignDelete}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "datetime", "select", "boolean", "url"];

function FieldsTab({ boardId }: { boardId: string }) {
  const { t } = useLanguage();
  const { fields, refresh } = useTrackerFields(boardId);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<TrackerFieldType>("text");
  const [options, setOptions] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    await createTrackerField(boardId, {
      name: name.trim(),
      fieldType,
      options: fieldType === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
    });
    setName("");
    setOptions("");
    await refresh();
  }

  async function handleReorder(index: number, dir: -1 | 1) {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderTrackerFields(next.map((f) => f.id));
    await refresh();
  }

  async function handleDelete(field: TrackerField) {
    await deleteTrackerField(field.id);
    await refresh();
  }

  return (
    <div className="space-y-2">
      {fields.map((field, i) => (
        <FieldRow
          key={field.id}
          field={field}
          isFirst={i === 0}
          isLast={i === fields.length - 1}
          expanded={expandedId === field.id}
          onToggleExpand={() => setExpandedId((id) => (id === field.id ? null : field.id))}
          onReorder={(dir) => handleReorder(i, dir)}
          onDelete={() => handleDelete(field)}
          onRefresh={refresh}
        />
      ))}

      <div className="space-y-1.5 rounded-apple-sm border border-dashed border-surface-border p-2.5">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tracker.newFieldPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
          />
          <Select
            fullWidth={false}
            className="h-7 shrink-0"
            value={fieldType}
            onChange={(v) => setFieldType(v as TrackerFieldType)}
            options={FIELD_TYPES.map((ft) => ({ value: ft, label: t(`tracker.fieldType.${ft}`) }))}
          />
          <button onClick={handleAdd} className="shrink-0 rounded-apple-sm bg-accent p-1 text-white">
            <Plus size={13} />
          </button>
        </div>
        {fieldType === "select" && (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={t("tracker.optionsPlaceholder")}
            className="w-full rounded-apple-sm border border-surface-border bg-surface-content px-2 h-7 text-[11.5px] text-label-primary outline-none placeholder:text-label-tertiary"
          />
        )}
      </div>
    </div>
  );
}

const fieldTypeInputType = (ft: TrackerFieldType) =>
  ft === "number" ? "number" : ft === "date" ? "date" : ft === "datetime" ? "datetime-local" : ft === "url" ? "url" : "text";

/** One custom field's row - collapsed it's just name/type/reorder/delete
 * (as before); expanded it exposes full editing (spec section 2): rename,
 * change type, set a default value, and for a "select" field add, remove,
 * rename, and reorder its options - with removed/renamed options cascaded
 * into every task's already-stored value on the backend (see
 * `rename_tracker_field_option` / `update_tracker_field`). */
function FieldRow({
  field,
  isFirst,
  isLast,
  expanded,
  onToggleExpand,
  onReorder,
  onDelete,
  onRefresh,
}: {
  field: TrackerField;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onReorder: (dir: -1 | 1) => void;
  onDelete: () => void;
  onRefresh: () => Promise<void> | void;
}) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const [name, setName] = useState(field.name);
  const [fieldType, setFieldType] = useState(field.fieldType);
  const [optionsList, setOptionsList] = useState<string[]>(field.options);
  const [defaultValue, setDefaultValue] = useState(field.defaultValue ?? "");
  const [newOption, setNewOption] = useState("");
  const [renamingOption, setRenamingOption] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setName(field.name);
    setFieldType(field.fieldType);
    setOptionsList(field.options);
    setDefaultValue(field.defaultValue ?? "");
  }, [field.id, field.name, field.fieldType, field.options, field.defaultValue]);

  async function persist(patch: { name?: string; fieldType?: TrackerFieldType; options?: string[]; defaultValue?: string | null }) {
    try {
      await updateTrackerField(field.id, {
        name: patch.name ?? name,
        fieldType: patch.fieldType ?? fieldType,
        options: patch.options ?? optionsList,
        defaultValue: patch.defaultValue !== undefined ? patch.defaultValue : defaultValue || null,
      });
      await onRefresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleAddOption() {
    const v = newOption.trim();
    if (!v || optionsList.includes(v)) return;
    const next = [...optionsList, v];
    setOptionsList(next);
    setNewOption("");
    await persist({ options: next });
  }

  async function handleRemoveOption(opt: string) {
    const next = optionsList.filter((o) => o !== opt);
    setOptionsList(next);
    await persist({ options: next });
  }

  async function handleReorderOption(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= optionsList.length) return;
    const next = [...optionsList];
    [next[idx], next[target]] = [next[target], next[idx]];
    setOptionsList(next);
    await persist({ options: next });
  }

  async function handleRenameOptionConfirm(oldOpt: string) {
    const v = renameValue.trim();
    if (!v || v === oldOpt) {
      setRenamingOption(null);
      return;
    }
    if (optionsList.some((o) => o !== oldOpt && o === v)) {
      showToast({ title: t("tracker.optionAlreadyExists"), variant: "error" });
      return;
    }
    try {
      await renameTrackerFieldOption(field.id, oldOpt, v);
      setRenamingOption(null);
      await onRefresh();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  return (
    <div className="overflow-hidden rounded-apple-sm border border-surface-border">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button onClick={onToggleExpand} title={t("tracker.editField")} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary">
          <ChevronRight size={13} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== field.name && persist({ name: name.trim() })}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none"
        />
        <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10.5px] text-label-tertiary dark:bg-white/[0.08]">{t(`tracker.fieldType.${field.fieldType}`)}</span>
        <button onClick={() => onReorder(-1)} disabled={isFirst} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
          <ArrowUp size={13} />
        </button>
        <button onClick={() => onReorder(1)} disabled={isLast} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
          <ArrowDown size={13} />
        </button>
        <button onClick={onDelete} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-2.5 border-t border-surface-border bg-black/[0.012] px-2.5 py-2.5 dark:bg-white/[0.015]">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={fieldLabelClass}>{t("tracker.fieldTypeLabel")}</label>
              <Select
                className="mt-1"
                value={fieldType}
                onChange={(v) => {
                  const next = v as TrackerFieldType;
                  setFieldType(next);
                  void persist({ fieldType: next });
                }}
                options={FIELD_TYPES.map((ft) => ({ value: ft, label: t(`tracker.fieldType.${ft}`) }))}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>{t("tracker.defaultValueLabel")}</label>
              {fieldType === "select" ? (
                <Select
                  className="mt-1"
                  value={defaultValue}
                  placeholder="—"
                  onChange={(v) => {
                    setDefaultValue(v);
                    void persist({ defaultValue: v || null });
                  }}
                  options={[{ value: "", label: "—" }, ...optionsList.map((o) => ({ value: o, label: o }))]}
                />
              ) : fieldType === "boolean" ? (
                <label className="mt-1 flex h-8 items-center gap-1.5 text-[12px] text-label-primary">
                  <input
                    type="checkbox"
                    checked={defaultValue === "true"}
                    onChange={(e) => {
                      const v = e.target.checked ? "true" : "false";
                      setDefaultValue(v);
                      void persist({ defaultValue: v });
                    }}
                    className="h-4 w-4 accent-accent"
                  />
                  {t("tracker.defaultValueChecked")}
                </label>
              ) : (
                <input
                  type={fieldTypeInputType(fieldType)}
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  onBlur={() => persist({ defaultValue: defaultValue || null })}
                  className={`mt-1 ${fieldInputClass}`}
                />
              )}
            </div>
          </div>

          {fieldType === "select" && (
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>{t("tracker.optionsLabel")}</label>
              {optionsList.length === 0 && <p className="text-[11.5px] text-label-tertiary">{t("tracker.noOptionsYet")}</p>}
              {optionsList.map((opt, oi) => (
                <div key={opt} className="flex items-center gap-1.5">
                  {renamingOption === opt ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameOptionConfirm(opt)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameOptionConfirm(opt)}
                      className="h-7 min-w-0 flex-1 rounded-apple-sm border border-accent/50 bg-surface-content px-2 text-[12px] text-label-primary outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setRenamingOption(opt);
                        setRenameValue(opt);
                      }}
                      title={t("tracker.renameOption")}
                      className="h-7 min-w-0 flex-1 truncate rounded-apple-sm px-2 text-left text-[12px] text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      {opt}
                    </button>
                  )}
                  <button onClick={() => handleReorderOption(oi, -1)} disabled={oi === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
                    <ArrowUp size={12} />
                  </button>
                  <button onClick={() => handleReorderOption(oi, 1)} disabled={oi === optionsList.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
                    <ArrowDown size={12} />
                  </button>
                  <button onClick={() => handleRemoveOption(opt)} title={t("tracker.removeOption")} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                  placeholder={t("tracker.newOptionPlaceholder")}
                  className="h-7 min-w-0 flex-1 rounded-apple-sm border border-dashed border-surface-border bg-transparent px-2 text-[12px] text-label-primary outline-none placeholder:text-label-tertiary"
                />
                <button onClick={handleAddOption} className="shrink-0 rounded-apple-sm bg-accent p-1 text-white">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabelsTab({ boardId }: { boardId: string }) {
  const { t } = useLanguage();
  const { labels, refresh } = useTrackerLabels(boardId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[1]);

  async function handleAdd() {
    if (!name.trim()) return;
    await createTrackerLabel(boardId, { name: name.trim(), color });
    setName("");
    await refresh();
  }

  async function handleDelete(label: TrackerLabel) {
    await deleteTrackerLabel(label.id);
    await refresh();
  }

  async function handleReorder(index: number, dir: -1 | 1) {
    const next = [...labels];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderTrackerLabels(next.map((l) => l.id));
    await refresh();
  }

  async function handleColorChange(label: TrackerLabel, color: string) {
    await updateTrackerLabel(label.id, { name: label.name, color });
    await refresh();
  }

  return (
    <div className="space-y-2">
      {labels.map((label, i) => (
        <div key={label.id} className="flex items-center gap-2 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <ColorSwatchButton color={label.color} onChange={(c) => handleColorChange(label, c)} />
          <input
            defaultValue={label.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== label.name && updateTrackerLabel(label.id, { name: e.target.value.trim(), color: label.color }).then(refresh)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none"
          />
          <button onClick={() => handleReorder(i, -1)} disabled={i === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => handleReorder(i, 1)} disabled={i === labels.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button onClick={() => handleDelete(label)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-apple-sm border border-dashed border-surface-border px-2.5 py-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`${newSwatchClass} ${color === c ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("tracker.newLabelPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
        />
        <button onClick={handleAdd} className="shrink-0 rounded-apple-sm bg-accent p-1 text-white">
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
