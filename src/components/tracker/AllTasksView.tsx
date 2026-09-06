import { ArrowDownWideNarrow, ArrowUpWideNarrow, Paperclip, X } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge, StatusPill, UpdateIndicator } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useProjects } from "@/hooks/useProjects";
import { useAllTrackerTasks, useTrackerBoards } from "@/hooks/useTracker";
import { getTrackerPriorities, getTrackerStatuses } from "@/services/api";
import type { SortDirection, TaskSortField, TrackerPriority, TrackerStatus, TrackerTask, TrackerTaskFilter } from "@/types";

interface AllTasksViewProps {
  filter: TrackerTaskFilter;
  onFilterChange: (f: TrackerTaskFilter) => void;
  sortField: TaskSortField;
  sortDir: SortDirection;
  onSortChange: (f: TaskSortField, d: SortDirection) => void;
  onOpenTask: (task: TrackerTask) => void;
  /** Bumped by the parent whenever a task changes elsewhere (edited, moved,
   * archived, deleted, duplicated) so this list re-fetches - it can't see
   * those changes on its own since it holds a separate cross-board query. */
  refreshSignal?: number;
}

const SORT_KEYS: Partial<Record<TaskSortField, string>> = {
  created: "tracker.sort.created",
  receivedAt: "tracker.sort.receivedAt",
  priority: "tracker.sort.priority",
  updatedAt: "tracker.sort.updatedAt",
  completedAt: "tracker.sort.completedAt",
  title: "tracker.sort.title",
};

export function AllTasksView({ filter, onFilterChange, sortField, sortDir, onSortChange, onOpenTask, refreshSignal }: AllTasksViewProps) {
  const { t } = useLanguage();
  const { boards } = useTrackerBoards();
  const { projects } = useProjects();
  const { tasks, loading, refresh } = useAllTrackerTasks({ ...filter, sortField, sortDir });

  useEffect(() => {
    if (refreshSignal) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);
  const [statusOptions, setStatusOptions] = useState<(TrackerStatus & { boardName?: string })[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<(TrackerPriority & { boardName?: string })[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (filter.boardId) {
        const statuses = await getTrackerStatuses(filter.boardId);
        if (!cancelled) setStatusOptions(statuses);
        return;
      }
      const all = await Promise.all(
        boards.map(async (b) => (await getTrackerStatuses(b.id)).map((s) => ({ ...s, boardName: b.name }))),
      );
      if (!cancelled) setStatusOptions(all.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, [filter.boardId, boards]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (filter.boardId) {
        const priorities = await getTrackerPriorities(filter.boardId);
        if (!cancelled) setPriorityOptions(priorities);
        return;
      }
      const all = await Promise.all(
        boards.map(async (b) => (await getTrackerPriorities(b.id)).map((p) => ({ ...p, boardName: b.name }))),
      );
      if (!cancelled) setPriorityOptions(all.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, [filter.boardId, boards]);

  function patch(next: Partial<TrackerTaskFilter>) {
    onFilterChange({ ...filter, ...next });
  }

  const activeFilterCount = Object.entries(filter).filter(([k, v]) => v !== undefined && v !== "" && k !== "search").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 border-b border-surface-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filter.search ?? ""}
            onChange={(e) => patch({ search: e.target.value || undefined })}
            placeholder={t("tracker.searchPlaceholder")}
            className="h-8 min-w-[160px] flex-1 max-w-xs rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 text-[13px] text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 dark:bg-white/[0.05]"
          />
          <select value={filter.boardId ?? ""} onChange={(e) => patch({ boardId: e.target.value || undefined, statusId: undefined })} className="h-8 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2 text-[12px] text-label-primary outline-none dark:bg-white/[0.05]">
            <option value="">{t("tracker.filterAllBoards")}</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select value={filter.statusId ?? ""} onChange={(e) => patch({ statusId: e.target.value || undefined })} className="h-8 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2 text-[12px] text-label-primary outline-none dark:bg-white/[0.05]">
            <option value="">{t("tracker.filterAllStatuses")}</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.boardName ? `${s.boardName}: ${s.name}` : s.name}
              </option>
            ))}
          </select>
          <select value={filter.projectId ?? ""} onChange={(e) => patch({ projectId: e.target.value || undefined })} className="h-8 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2 text-[12px] text-label-primary outline-none dark:bg-white/[0.05]">
            <option value="">{t("tracker.filterAllProjects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={filter.priorityId ?? ""} onChange={(e) => patch({ priorityId: e.target.value || undefined })} className="h-8 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2 text-[12px] text-label-primary outline-none dark:bg-white/[0.05]">
            <option value="">{t("tracker.filterAllPriorities")}</option>
            {priorityOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.boardName ? `${p.boardName}: ${p.name}` : p.name}
              </option>
            ))}
          </select>

          <div className="flex-1" />

          <div className="relative">
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as TaskSortField, sortDir)}
              className="h-8 rounded-apple-sm border border-surface-border bg-black/[0.03] pl-2 pr-6 text-[12px] text-label-primary outline-none dark:bg-white/[0.05]"
            >
              {(Object.entries(SORT_KEYS) as [TaskSortField, string][]).map(([f, key]) => (
                <option key={f} value={f}>
                  {t(key)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => onSortChange(sortField, sortDir === "asc" ? "desc" : "asc")}
            className="flex h-8 w-8 items-center justify-center rounded-apple-sm border border-surface-border bg-black/[0.03] text-label-secondary hover:text-label-primary dark:bg-white/[0.05]"
          >
            {sortDir === "asc" ? <ArrowUpWideNarrow size={13} /> : <ArrowDownWideNarrow size={13} />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-label-secondary">
            <input type="checkbox" checked={filter.hasFiles === true} onChange={(e) => patch({ hasFiles: e.target.checked ? true : undefined })} className="accent-accent" />
            {t("tracker.filterHasFiles")}
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-label-secondary">
            <input type="checkbox" checked={filter.includeArchived === true} onChange={(e) => patch({ includeArchived: e.target.checked ? true : undefined })} className="accent-accent" />
            {t("tracker.filterIncludeArchived")}
          </label>
          {activeFilterCount > 0 && (
            <button onClick={() => onFilterChange({})} className="flex items-center gap-1 text-[11.5px] text-accent hover:underline">
              <X size={11} />
              {t("tracker.clearFilters")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && <p className="px-2 py-4 text-[12.5px] text-label-secondary">{t("files.loading")}</p>}
        {!loading && tasks.length === 0 && <EmptyState title={t("tracker.noTasksTitle")} description={t("tracker.noTasksDescription")} />}
        <div className="space-y-1">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onOpenTask(task)}
              className="flex w-full items-center gap-3 rounded-apple-sm px-3 py-2.5 text-left transition-colors hover:bg-surface-card-hover"
            >
              <div className="min-w-0 flex-[2]">
                <p className="truncate text-[13px] font-medium text-label-primary">{task.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-label-secondary">
                  {task.boardName}
                  {task.projectName ? ` · ${task.projectName}` : ""}
                </p>
                {task.description && <p className="mt-0.5 truncate text-[11px] text-label-tertiary">{task.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {task.fileCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-label-tertiary">
                    <Paperclip size={11} />
                    {task.fileCount}
                  </span>
                )}
                {task.hasUnseenUpdate && <UpdateIndicator />}
                <PriorityBadge name={task.priorityName} color={task.priorityColor} />
                <StatusPill name={task.statusName} color={task.statusColor} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
