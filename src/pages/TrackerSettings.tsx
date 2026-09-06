import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import { useTrackerSettings } from "@/hooks/useTracker";
import { ApiError, createTrackerBoard, deleteTrackerBoard, reorderTrackerBoards, updateTrackerSettings } from "@/services/api";
import type { CardDisplayConfig, Priority, TrackerBoard, TrackerSettings as TrackerSettingsType } from "@/types";

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">{title}</h2>
      <div className="overflow-hidden rounded-apple border border-surface-border bg-surface-card shadow-card">{children}</div>
    </section>
  );
}

const PRIORITY_ORDER: Priority[] = ["low", "normal", "high", "critical"];

interface TrackerSettingsPageProps {
  boards: TrackerBoard[];
  onBoardsChanged: () => void;
}

export function TrackerSettingsPage({ boards, onBoardsChanged }: TrackerSettingsPageProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const { settings, refresh: refreshSettings } = useTrackerSettings();
  const [newBoardName, setNewBoardName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TrackerBoard | null>(null);
  const [draft, setDraft] = useState<TrackerSettingsType | null>(null);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  async function handleCreateBoard() {
    if (!newBoardName.trim()) return;
    await createTrackerBoard({ name: newBoardName.trim() });
    setNewBoardName("");
    onBoardsChanged();
  }

  async function handleReorder(index: number, dir: -1 | 1) {
    const next = [...boards];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderTrackerBoards(next.map((b) => b.id));
    onBoardsChanged();
  }

  async function handleDeleteBoard() {
    if (!deleteTarget) return;
    await deleteTrackerBoard(deleteTarget.id);
    setDeleteTarget(null);
    onBoardsChanged();
  }

  async function handleSaveDraft() {
    if (!draft) return;
    try {
      await updateTrackerSettings(draft);
      await refreshSettings();
      showToast({ title: t("common.save") });
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  function updatePriority(priority: Priority, patch: Partial<{ label: string; color: string }>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev.priorities[priority] ?? { label: priority, color: "#8E8E93" };
      return { ...prev, priorities: { ...prev.priorities, [priority]: { ...current, ...patch } } };
    });
  }

  function toggleDisplay(key: keyof CardDisplayConfig) {
    setDraft((prev) => (prev ? { ...prev, cardDisplay: { ...prev.cardDisplay, [key]: !prev.cardDisplay[key] } } : prev));
  }

  return (
    <div className="h-full flex-1 overflow-y-auto px-8 pb-10 pt-10">
      <div className="drag-region mb-6">
        <h1 className="text-[20px] font-semibold text-label-primary">{t("tracker.settingsTitle")}</h1>
      </div>

      <div className="no-drag mx-auto max-w-lg">
        <SettingsSection title={t("tracker.boardSettingsTab.general") + " · " + t("sidebar.tracker")}>
          {boards.map((board, i) => (
            <div key={board.id} className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-[13px] text-label-primary">{board.name}</span>
              <span className="shrink-0 text-[11px] text-label-tertiary">{board.taskCount}</span>
              <button onClick={() => handleReorder(i, -1)} disabled={i === 0} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
                <ArrowUp size={13} />
              </button>
              <button onClick={() => handleReorder(i, 1)} disabled={i === boards.length - 1} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:text-label-primary disabled:opacity-30">
                <ArrowDown size={13} />
              </button>
              <button onClick={() => setDeleteTarget(board)} className="shrink-0 rounded-apple-sm p-1 text-label-tertiary hover:bg-danger/10 hover:text-danger">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <input
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
              placeholder={t("tracker.newBoardPlaceholder")}
              className="min-w-0 flex-1 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 dark:bg-white/[0.05]"
            />
            <Button size="sm" variant="secondary" onClick={handleCreateBoard}>
              <Plus size={13} />
              {t("tracker.newBoard")}
            </Button>
          </div>
        </SettingsSection>

        {draft && (
          <>
            <SettingsSection title={t("tracker.settingsTab.priorities")}>
              {PRIORITY_ORDER.map((p) => {
                const cfg = draft.priorities[p] ?? { label: p, color: "#8E8E93" };
                return (
                  <div key={p} className="flex items-center gap-2 border-b border-surface-border px-4 py-2.5 last:border-b-0">
                    <input type="color" value={cfg.color} onChange={(e) => updatePriority(p, { color: e.target.value })} className="h-7 w-7 shrink-0 cursor-pointer rounded border border-surface-border bg-transparent" />
                    <input value={cfg.label} onChange={(e) => updatePriority(p, { label: e.target.value })} className="min-w-0 flex-1 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none dark:bg-white/[0.05]" />
                  </div>
                );
              })}
            </SettingsSection>

            <SettingsSection title={t("tracker.settingsTab.display")}>
              {(
                [
                  ["showProject", t("tracker.fieldProject")],
                  ["showPriority", t("tracker.fieldPriority")],
                  ["showDueDate", t("tracker.fieldDueAt")],
                  ["showFileCount", t("tracker.tabFiles")],
                  ["showUpdateIndicator", t("tracker.fileUpdated")],
                ] as [keyof CardDisplayConfig, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between border-b border-surface-border px-4 py-2.5 text-[13px] text-label-primary last:border-b-0">
                  {label}
                  <input type="checkbox" checked={draft.cardDisplay[key]} onChange={() => toggleDisplay(key)} className="h-4 w-4 accent-accent" />
                </label>
              ))}
            </SettingsSection>

            <div className="mb-7 flex justify-end">
              <Button variant="primary" onClick={handleSaveDraft}>
                {t("common.save")}
              </Button>
            </div>
          </>
        )}

        <SiteFooter />
      </div>

      <DeleteModal
        open={deleteTarget !== null}
        title={t("tracker.deleteBoardTitle")}
        message={t("tracker.deleteBoardMessage")}
        confirmValue={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteBoard}
      />
    </div>
  );
}
