import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Check, ChevronDown, Plus, Search, Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TaskCard, TaskCardOverlay } from "@/components/tracker/TaskCard";
import { useLanguage } from "@/hooks/useLanguage";
import { getAllTrackerTasks } from "@/services/api";
import type { CardDisplayConfig, CardSize, TrackerPriority, TrackerStatus, TrackerTask } from "@/types";

interface BoardKanbanProps {
  boardId: string;
  statuses: TrackerStatus[];
  tasks: TrackerTask[];
  priorities: TrackerPriority[];
  cardSize: CardSize;
  display?: CardDisplayConfig;
  /** Keyed by statusId - whether that column has more tasks past what's
   * currently loaded (see `useTrackerTasks`). */
  columnHasMore: Record<string, boolean>;
  columnLoadingMore: Record<string, boolean>;
  onLoadMoreForStatus: (statusId: string) => void;
  onOpenTask: (task: TrackerTask) => void;
  onMove: (taskId: string, statusId: string, orderedIds: string[]) => void;
  onQuickAdd: (statusId: string, title: string) => void;
  onOpenBoardSettings: () => void;
  onChangeStatus: (task: TrackerTask, statusId: string) => void;
  onChangePriority: (task: TrackerTask, priorityId: string) => void;
  onDeleteRequest: (task: TrackerTask) => void;
}

/** Multi-select "which status columns are shown" dropdown - checkboxes plus
 * select-all/none, portal-rendered like `Select` so it's never clipped by
 * the board's own horizontally-scrolling column strip. */
function StatusFilterDropdown({
  statuses,
  hiddenStatusIds,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  statuses: TrackerStatus[];
  hiddenStatusIds: Set<string>;
  onToggle: (statusId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const visibleCount = statuses.length - hiddenStatusIds.size;

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ left: rect.left, top: rect.bottom + 4, width: Math.max(rect.width, 200) });
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 text-[12.5px] text-label-primary dark:bg-white/[0.05] ${
          hiddenStatusIds.size > 0 ? "border-accent/50 text-accent" : ""
        }`}
      >
        {t("tracker.filterStatuses")}
        <span className="tabular-nums text-label-tertiary">
          {visibleCount}/{statuses.length}
        </span>
        <ChevronDown size={13} className="shrink-0 text-label-tertiary" />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[95]" onMouseDown={() => setOpen(false)} onContextMenu={() => setOpen(false)} />
            <div
              style={{ left: pos.left, top: pos.top, minWidth: pos.width }}
              className="animate-scale-in fixed z-[96] max-h-72 overflow-y-auto rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple"
            >
              <div className="flex items-center gap-1 border-b border-surface-border px-1.5 pb-1">
                <button onClick={onSelectAll} className="rounded-apple-sm px-2 py-1 text-[11.5px] text-accent hover:bg-accent/[0.12]">
                  {t("common.selectAll")}
                </button>
                <button onClick={onSelectNone} className="rounded-apple-sm px-2 py-1 text-[11.5px] text-accent hover:bg-accent/[0.12]">
                  {t("common.selectNone")}
                </button>
              </div>
              {statuses.map((status) => {
                const checked = !hiddenStatusIds.has(status.id);
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => onToggle(status.id)}
                    className="flex w-full items-center gap-2 rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] text-label-primary transition-colors hover:bg-accent hover:text-white"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-accent bg-accent text-white" : "border-surface-border"
                      }`}
                    >
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="min-w-0 flex-1 truncate">{status.name}</span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

type Columns = Record<string, TrackerTask[]>;

function groupByStatus(statuses: TrackerStatus[], tasks: TrackerTask[]): Columns {
  const columns: Columns = {};
  for (const status of statuses) {
    columns[status.id] = [];
  }
  for (const task of tasks) {
    (columns[task.statusId] ??= []).push(task);
  }
  return columns;
}

function QuickAddRow({ onSubmit, onCancel }: { onSubmit: (title: string) => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  return (
    <div className="rounded-apple border border-accent/40 bg-surface-card p-2 shadow-card">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("tracker.taskTitlePlaceholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onSubmit(value.trim());
            setValue("");
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="w-full bg-transparent text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary"
      />
      <div className="mt-1.5 flex justify-end gap-1">
        <button onClick={onCancel} className="rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]">
          <X size={13} />
        </button>
        <button
          disabled={!value.trim()}
          onClick={() => {
            if (value.trim()) {
              onSubmit(value.trim());
              setValue("");
            }
          }}
          className="rounded-apple-sm bg-accent px-2 py-1 text-[11.5px] font-medium text-white disabled:opacity-40"
        >
          {t("common.create")}
        </button>
      </div>
    </div>
  );
}

function Column({
  status,
  statuses,
  priorities,
  tasks,
  cardSize,
  display,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenTask,
  isDropTarget,
  quickAddOpen,
  onQuickAddOpen,
  onQuickAddSubmit,
  onQuickAddCancel,
  onChangeStatus,
  onChangePriority,
  onDeleteRequest,
  dndDisabled,
}: {
  status: TrackerStatus;
  statuses: TrackerStatus[];
  priorities: TrackerPriority[];
  tasks: TrackerTask[];
  cardSize: CardSize;
  display?: CardDisplayConfig;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenTask: (task: TrackerTask) => void;
  isDropTarget: boolean;
  quickAddOpen: boolean;
  onQuickAddOpen: () => void;
  onQuickAddSubmit: (title: string) => void;
  onQuickAddCancel: () => void;
  onChangeStatus: (task: TrackerTask, statusId: string) => void;
  onChangePriority: (task: TrackerTask, priorityId: string) => void;
  onDeleteRequest: (task: TrackerTask) => void;
  dndDisabled: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status.id });

  // Fetches this column's next page a little before its loaded cards
  // actually run out - each column scrolls independently, so this has to
  // watch this one element's own scroll position rather than the page's.
  function handleScroll(el: HTMLDivElement) {
    if (!hasMore || loadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      onLoadMore();
    }
  }

  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      <div className="mb-2 flex h-6 shrink-0 items-center gap-2 px-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="min-w-0 truncate text-[12.5px] font-semibold text-label-primary">{status.name}</h3>
        <span className="shrink-0 rounded-full bg-black/[0.06] px-1.5 py-px text-[10.5px] font-medium tabular-nums text-label-tertiary dark:bg-white/[0.08]">
          {status.taskCount}
        </span>
        <div className="flex-1" />
        <button
          onClick={onQuickAddOpen}
          className="shrink-0 rounded-apple-sm p-1 text-label-tertiary transition-colors hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]"
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        onScroll={(e) => handleScroll(e.currentTarget)}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 overflow-y-auto rounded-apple-lg border p-1.5 transition-colors duration-150 ${
          isDropTarget
            ? "border-accent/50 bg-accent/[0.05]"
            : "border-transparent bg-black/[0.015] dark:bg-white/[0.02]"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              compact={cardSize === "compact"}
              display={display}
              onOpen={onOpenTask}
              statuses={statuses}
              priorities={priorities}
              onChangeStatus={onChangeStatus}
              onChangePriority={onChangePriority}
              onDeleteRequest={onDeleteRequest}
              dndDisabled={dndDisabled}
            />
          ))}
        </SortableContext>
        {loadingMore && <p className="py-1.5 text-center text-[10.5px] text-label-tertiary">…</p>}
        {quickAddOpen && <QuickAddRow onSubmit={onQuickAddSubmit} onCancel={onQuickAddCancel} />}
      </div>
    </div>
  );
}

export function BoardKanban({
  boardId,
  statuses,
  tasks,
  priorities,
  cardSize,
  display,
  columnHasMore,
  columnLoadingMore,
  onLoadMoreForStatus,
  onOpenTask,
  onMove,
  onQuickAdd,
  onOpenBoardSettings,
  onChangeStatus,
  onChangePriority,
  onDeleteRequest,
}: BoardKanbanProps) {
  const { t } = useLanguage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [columns, setColumns] = useState<Columns>(() => groupByStatus(statuses, tasks));
  const [quickAddStatusId, setQuickAddStatusId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TrackerTask | null>(null);
  const [overContainerId, setOverContainerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Ids of statuses hidden by the column filter below - empty means "every
  // status is shown" (the default), so a newly created status shows up on
  // the board without the user having to opt it in.
  const [hiddenStatusIds, setHiddenStatusIds] = useState<Set<string>>(new Set());
  // Backend-matched task ids for the current query - null while there's no
  // query, or while the debounced fetch below hasn't resolved yet (in which
  // case filteredTasks below falls back to a plain client-side title match
  // so results don't flash empty during that brief window). Going through
  // the backend (rather than filtering `tasks` by title alone) is what lets
  // this match a task's attached file/link names too, same as All Tasks'
  // search - it only ever narrows within the tasks already loaded on this
  // board, though, so a match that exists only past a column's load cap
  // still won't surface until that column is scrolled further.
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);

  const query = searchQuery.trim().toLowerCase();
  const visibleStatuses = statuses.filter((s) => !hiddenStatusIds.has(s.id));

  useEffect(() => {
    if (query === "") {
      setSearchMatchIds(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getAllTrackerTasks({ boardId, search: query, limit: 1000 })
        .then((hits) => {
          if (!cancelled) setSearchMatchIds(new Set(hits.map((h) => h.id)));
        })
        .catch(() => {
          if (!cancelled) setSearchMatchIds(new Set());
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, boardId]);

  // Case-insensitive, Unicode-aware (JS `toLowerCase()` handles Cyrillic
  // correctly, unlike SQLite's `LOWER()` - see the backend fix for the same
  // bug in tracker task search) substring match, scoped to whichever
  // statuses are currently visible.
  const isFiltered = query !== "" || hiddenStatusIds.size > 0;
  const filteredTasks = isFiltered
    ? tasks.filter(
        (task) =>
          !hiddenStatusIds.has(task.statusId) &&
          (query === "" || (searchMatchIds?.has(task.id) ?? task.title.toLowerCase().includes(query))),
      )
    : tasks;
  // While actively searching, a column with zero matches is noise - hide it
  // entirely rather than showing an empty column. Only search does this
  // (not the status checkbox filter above): that filter is the user's own
  // explicit choice of which columns to see, so it must never be overridden
  // just because a column happens to be empty right now.
  const displayedStatuses = query !== "" ? visibleStatuses.filter((s) => filteredTasks.some((t) => t.statusId === s.id)) : visibleStatuses;

  useEffect(() => {
    // A drag in progress owns `columns` as local, optimistic state - only
    // resync from the server-driven `tasks` prop when nothing is being
    // dragged, so a mid-drag refetch (e.g. another task's "file updated"
    // sync) can never yank a card out from under the pointer.
    if (!activeTask) {
      setColumns(groupByStatus(displayedStatuses, filteredTasks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, tasks, hiddenStatusIds, searchQuery]);

  function findContainer(id: string): string | undefined {
    if (columns[id]) return id;
    return Object.keys(columns).find((statusId) => columns[statusId].some((t) => t.id === id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const container = findContainer(id);
    const task = container ? columns[container].find((t) => t.id === id) : undefined;
    setActiveTask(task ?? null);
    setOverContainerId(container ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      setOverContainerId(null);
      return;
    }
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    setOverContainerId(overContainer ?? null);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;
      const overIndex = overItems.findIndex((t) => t.id === over.id);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;
      const movedTask = activeItems[activeIndex];
      return {
        ...prev,
        [activeContainer]: activeItems.filter((t) => t.id !== active.id),
        [overContainer]: [...overItems.slice(0, newIndex), movedTask, ...overItems.slice(newIndex)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setOverContainerId(null);
    if (!over) {
      setColumns(groupByStatus(displayedStatuses, filteredTasks));
      return;
    }
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string) ?? activeContainer;
    if (!activeContainer || !overContainer) return;

    let finalColumn = columns[overContainer];
    if (activeContainer === overContainer) {
      const activeIndex = finalColumn.findIndex((t) => t.id === active.id);
      const overIndex = finalColumn.findIndex((t) => t.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalColumn = arrayMove(finalColumn, activeIndex, overIndex);
        setColumns((prev) => ({ ...prev, [overContainer]: finalColumn }));
      }
    }
    onMove(active.id as string, overContainer, finalColumn.map((t) => t.id));
  }

  function handleDragCancel() {
    setActiveTask(null);
    setOverContainerId(null);
    setColumns(groupByStatus(displayedStatuses, filteredTasks));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="no-drag flex shrink-0 items-center gap-2 px-6 pb-2 pt-1">
        <div className="relative min-w-[160px] max-w-xs flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-tertiary" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("tracker.boardSearchPlaceholder")}
            className="h-8 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] pl-7 pr-7 text-[12.5px] text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 dark:bg-white/[0.05]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-apple-sm p-1 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <StatusFilterDropdown
          statuses={statuses}
          hiddenStatusIds={hiddenStatusIds}
          onToggle={(statusId) =>
            setHiddenStatusIds((prev) => {
              const next = new Set(prev);
              if (next.has(statusId)) next.delete(statusId);
              else next.add(statusId);
              return next;
            })
          }
          onSelectAll={() => setHiddenStatusIds(new Set())}
          onSelectNone={() => setHiddenStatusIds(new Set(statuses.map((s) => s.id)))}
        />
        <div className="flex-1" />
        <button
          onClick={onOpenBoardSettings}
          className="flex items-center gap-1.5 rounded-apple-sm px-2 py-1 text-[12px] text-label-secondary transition-colors hover:bg-black/[0.05] hover:text-label-primary dark:hover:bg-white/[0.08]"
        >
          <SettingsIcon size={13} />
          {t("tracker.boardSettings")}
        </button>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={{ acceleration: 12, threshold: { x: 0.15, y: 0.2 } }}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto px-6 pb-6">
          {visibleStatuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              statuses={statuses}
              priorities={priorities}
              tasks={columns[status.id] ?? []}
              cardSize={cardSize}
              display={display}
              hasMore={columnHasMore[status.id] ?? false}
              loadingMore={columnLoadingMore[status.id] ?? false}
              onLoadMore={() => onLoadMoreForStatus(status.id)}
              onOpenTask={onOpenTask}
              isDropTarget={overContainerId === status.id && activeTask !== null}
              quickAddOpen={quickAddStatusId === status.id}
              onQuickAddOpen={() => setQuickAddStatusId(status.id)}
              onQuickAddSubmit={(title) => {
                onQuickAdd(status.id, title);
                setQuickAddStatusId(null);
              }}
              onQuickAddCancel={() => setQuickAddStatusId(null)}
              onChangeStatus={onChangeStatus}
              onChangePriority={onChangePriority}
              onDeleteRequest={onDeleteRequest}
              dndDisabled={isFiltered}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
          {activeTask && <TaskCardOverlay task={activeTask} compact={cardSize === "compact"} display={display} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
