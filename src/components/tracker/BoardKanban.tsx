import { DndContext, type DragEndEvent, type DragOverEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useState } from "react";

import { TaskCard } from "@/components/tracker/TaskCard";
import { useLanguage } from "@/hooks/useLanguage";
import type { CardDisplayConfig, CardSize, PriorityConfig, TrackerStatus, TrackerTask } from "@/types";

interface BoardKanbanProps {
  statuses: TrackerStatus[];
  tasks: TrackerTask[];
  cardSize: CardSize;
  display?: CardDisplayConfig;
  priorities?: Record<string, PriorityConfig>;
  onOpenTask: (task: TrackerTask) => void;
  onMove: (taskId: string, statusId: string, orderedIds: string[]) => void;
  onQuickAdd: (statusId: string, title: string) => void;
  onOpenBoardSettings: () => void;
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
    <div className="rounded-apple border border-accent/40 bg-surface-card p-2">
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
  tasks,
  cardSize,
  display,
  priorities,
  onOpenTask,
  quickAddOpen,
  onQuickAddOpen,
  onQuickAddSubmit,
  onQuickAddCancel,
}: {
  status: TrackerStatus;
  tasks: TrackerTask[];
  cardSize: CardSize;
  display?: CardDisplayConfig;
  priorities?: Record<string, PriorityConfig>;
  onOpenTask: (task: TrackerTask) => void;
  quickAddOpen: boolean;
  onQuickAddOpen: () => void;
  onQuickAddSubmit: (title: string) => void;
  onQuickAddCancel: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: status.id });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="truncate text-[12.5px] font-semibold text-label-primary">{status.name}</h3>
        <span className="rounded-full bg-black/[0.06] px-1.5 text-[11px] text-label-tertiary dark:bg-white/[0.08]">
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
      <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto rounded-apple-lg bg-black/[0.015] p-1.5 dark:bg-white/[0.02]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} compact={cardSize === "compact"} display={display} priorities={priorities} onOpen={onOpenTask} />
          ))}
        </SortableContext>
        {quickAddOpen && <QuickAddRow onSubmit={onQuickAddSubmit} onCancel={onQuickAddCancel} />}
      </div>
    </div>
  );
}

export function BoardKanban({
  statuses,
  tasks,
  cardSize,
  display,
  priorities,
  onOpenTask,
  onMove,
  onQuickAdd,
  onOpenBoardSettings,
}: BoardKanbanProps) {
  const { t } = useLanguage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [columns, setColumns] = useState<Columns>(() => groupByStatus(statuses, tasks));
  const [quickAddStatusId, setQuickAddStatusId] = useState<string | null>(null);

  useEffect(() => {
    setColumns(groupByStatus(statuses, tasks));
  }, [statuses, tasks]);

  function findContainer(id: string): string | undefined {
    if (columns[id]) return id;
    return Object.keys(columns).find((statusId) => columns[statusId].some((t) => t.id === id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
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
    if (!over) {
      setColumns(groupByStatus(statuses, tasks));
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-end px-6 pb-2 pt-1">
        <button
          onClick={onOpenBoardSettings}
          className="no-drag flex items-center gap-1.5 rounded-apple-sm px-2 py-1 text-[12px] text-label-secondary transition-colors hover:bg-black/[0.05] hover:text-label-primary dark:hover:bg-white/[0.08]"
        >
          <SettingsIcon size={13} />
          {t("tracker.boardSettings")}
        </button>
      </div>
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6">
          {statuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              tasks={columns[status.id] ?? []}
              cardSize={cardSize}
              display={display}
              priorities={priorities}
              onOpenTask={onOpenTask}
              quickAddOpen={quickAddStatusId === status.id}
              onQuickAddOpen={() => setQuickAddStatusId(status.id)}
              onQuickAddSubmit={(title) => {
                onQuickAdd(status.id, title);
                setQuickAddStatusId(null);
              }}
              onQuickAddCancel={() => setQuickAddStatusId(null)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
