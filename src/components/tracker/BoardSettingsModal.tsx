import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { Modal, ModalBody, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerFields, useTrackerLabels, useTrackerStatuses } from "@/hooks/useTracker";
import {
  ApiError,
  createTrackerField,
  createTrackerLabel,
  createTrackerStatus,
  deleteTrackerBoard,
  deleteTrackerField,
  deleteTrackerLabel,
  deleteTrackerStatus,
  reorderTrackerFields,
  reorderTrackerLabels,
  reorderTrackerStatuses,
  setTrackerBoardCardSize,
  setTrackerStatusDefault,
  setTrackerStatusIsDone,
  updateTrackerBoard,
  updateTrackerField,
  updateTrackerLabel,
  updateTrackerStatus,
} from "@/services/api";
import type { CardSize, TrackerBoard, TrackerField, TrackerFieldType, TrackerLabel, TrackerStatus } from "@/types";

interface BoardSettingsModalProps {
  open: boolean;
  board: TrackerBoard;
  onClose: () => void;
  onBoardChanged: () => void;
  onBoardDeleted: () => void;
}

type Tab = "general" | "statuses" | "fields" | "labels";

const swatchClass = "h-6 w-6 shrink-0 rounded-full border border-black/10";
const COLORS = ["#8E8E93", "#0A84FF", "#30D158", "#FF9F0A", "#FF453A", "#BF5AF2", "#64D2FF", "#FFD60A"];

export function BoardSettingsModal({ open, board, onClose, onBoardChanged, onBoardDeleted }: BoardSettingsModalProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("general");

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <ModalHeader title={t("tracker.boardSettingsTitle", { name: board.name })} />
      <div className="flex gap-1 border-b border-surface-border px-5">
        {(["general", "statuses", "fields", "labels"] as Tab[]).map((tb) => (
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
        <div className="max-h-[55vh] overflow-y-auto">
          {tab === "general" && <GeneralTab board={board} onBoardChanged={onBoardChanged} onBoardDeleted={onBoardDeleted} onClose={onClose} />}
          {tab === "statuses" && <StatusesTab boardId={board.id} />}
          {tab === "fields" && <FieldsTab boardId={board.id} />}
          {tab === "labels" && <LabelsTab boardId={board.id} />}
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
    await createTrackerStatus(boardId, { name: name.trim(), color });
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
        <div key={status.id} className="flex items-center gap-2 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
          <input
            defaultValue={status.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== status.name && updateTrackerStatus(status.id, { name: e.target.value.trim(), color: status.color }).then(refresh)}
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
          <label className="flex shrink-0 items-center gap-1 text-[10.5px] text-label-tertiary">
            <input type="checkbox" checked={status.isDone} onChange={(e) => setTrackerStatusIsDone(status.id, e.target.checked).then(refresh)} className="accent-accent" />
            {t("tracker.isDoneStatus")}
          </label>
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
      ))}

      <div className="flex items-center gap-2 rounded-apple-sm border border-dashed border-surface-border px-2.5 py-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`${swatchClass} ${color === c ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
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
          <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="mt-2 w-full rounded-apple-sm border border-surface-border bg-surface-content px-2 h-8 text-[12.5px] outline-none">
            {statuses.filter((s) => s.id !== reassignTarget.id).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
        <div key={field.id} className="flex items-center gap-2 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <input
            defaultValue={field.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== field.name && updateTrackerField(field.id, { name: e.target.value.trim(), fieldType: field.fieldType, options: field.options }).then(refresh)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none"
          />
          <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10.5px] text-label-tertiary dark:bg-white/[0.08]">{t(`tracker.fieldType.${field.fieldType}`)}</span>
          <button onClick={() => handleReorder(i, -1)} disabled={i === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => handleReorder(i, 1)} disabled={i === fields.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button onClick={() => handleDelete(field)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <div className="space-y-1.5 rounded-apple-sm border border-dashed border-surface-border p-2.5">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tracker.newFieldPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
          />
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as TrackerFieldType)} className="shrink-0 rounded-apple-sm border border-surface-border bg-surface-content px-2 h-7 text-[11.5px] outline-none">
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`tracker.fieldType.${ft}`)}
              </option>
            ))}
          </select>
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

  return (
    <div className="space-y-2">
      {labels.map((label, i) => (
        <div key={label.id} className="flex items-center gap-2 rounded-apple-sm border border-surface-border px-2.5 py-2">
          <span className={swatchClass} style={{ backgroundColor: label.color }} />
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
            <button key={c} onClick={() => setColor(c)} className={`${swatchClass} ${color === c ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
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
