import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderClosed } from "lucide-react";
import { useState } from "react";

import { ContextMenu } from "@/components/ContextMenu";
import { FileCountBadge, PinIndicator, PriorityBadge, UpdateIndicator, taskContextMenuItems } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import type { CardDisplayConfig, TrackerPriority, TrackerStatus, TrackerTask } from "@/types";

interface TaskCardProps {
  task: TrackerTask;
  compact: boolean;
  display?: CardDisplayConfig;
  onOpen: (task: TrackerTask) => void;
  statuses: TrackerStatus[];
  priorities: TrackerPriority[];
  onChangeStatus: (task: TrackerTask, statusId: string) => void;
  onChangePriority: (task: TrackerTask, priorityId: string) => void;
  onDeleteRequest: (task: TrackerTask) => void;
  /** Disables drag-and-drop reordering - set while a search/status filter is
   * active, since a column then only holds a subset of its real tasks and
   * reordering it would silently reshuffle the hidden ones too. */
  dndDisabled?: boolean;
}

const DEFAULT_DISPLAY: CardDisplayConfig = {
  showProject: true,
  showPriority: true,
  showFileCount: true,
  showUpdateIndicator: true,
};

/** The card's actual content - shared by the real (sortable) card and the
 * floating copy dnd-kit's DragOverlay renders under the cursor while it's
 * being dragged, so the two never drift out of sync visually. */
function TaskCardBody({ task, compact, display }: { task: TrackerTask; compact: boolean; display: CardDisplayConfig }) {
  return (
    <>
      <div className="flex items-start gap-1.5">
        {task.pinned && <PinIndicator className="mt-0.5" />}
        <p className={`min-w-0 flex-1 font-medium text-label-primary ${compact ? "text-[12.5px] leading-snug" : "text-[13px] leading-snug"}`}>
          {task.title}
        </p>
      </div>

      {!compact && display.showProject && task.projectName && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-label-secondary">
          <FolderClosed size={11} className="shrink-0" />
          <span className="truncate">{task.projectName}</span>
        </p>
      )}

      {!compact && task.description && (
        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-label-secondary">{task.description}</p>
      )}

      {(display.showPriority || (display.showUpdateIndicator && task.hasUnseenUpdate)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {display.showPriority && <PriorityBadge name={task.priorityName} color={task.priorityColor} />}
          {display.showUpdateIndicator && task.hasUnseenUpdate && <UpdateIndicator />}
        </div>
      )}

      {!compact && display.showFileCount && task.fileCount > 0 && (
        <div className="mt-1.5 flex items-center justify-end">
          <FileCountBadge count={task.fileCount} />
        </div>
      )}
    </>
  );
}

const CARD_SHELL =
  "rounded-apple border border-surface-border bg-surface-card shadow-card transition-[background-color,border-color,box-shadow] duration-150";

/** Sits in the dragged card's original slot for as long as the drag lasts -
 * a soft "insertion point" highlight rather than the real card, which is
 * off following the cursor in DragOverlay instead (see BoardKanban). */
function TaskCardPlaceholder({ compact, setNodeRef, style }: { compact: boolean; setNodeRef: (node: HTMLElement | null) => void; style: React.CSSProperties }) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-apple border-2 border-dashed border-accent/35 bg-accent/[0.05] ${compact ? "h-[54px]" : "h-[100px]"}`}
    />
  );
}

export function TaskCard({
  task,
  compact,
  display = DEFAULT_DISPLAY,
  onOpen,
  statuses,
  priorities,
  onChangeStatus,
  onChangePriority,
  onDeleteRequest,
  dndDisabled = false,
}: TaskCardProps) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: dndDisabled });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  };

  if (isDragging) {
    return <TaskCardPlaceholder compact={compact} setNodeRef={setNodeRef} style={style} />;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`group touch-none select-none ${dndDisabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${CARD_SHELL} hover:border-surface-border hover:bg-surface-card-hover hover:shadow-popover ${
        compact ? "px-2.5 py-2" : "p-3"
      } ${task.archived ? "opacity-50" : ""}`}
    >
      <TaskCardBody task={task} compact={compact} display={display} />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={taskContextMenuItems(task, statuses, priorities, t, { onChangeStatus, onChangePriority, onDeleteRequest })}
        />
      )}
    </div>
  );
}

/** The floating copy rendered inside <DragOverlay> - visually "lifted" off
 * the board (stronger shadow, a hint of scale/rotation) so picking a card
 * up reads as a physical action, not a teleport. */
export function TaskCardOverlay({ task, compact, display = DEFAULT_DISPLAY }: { task: TrackerTask; compact: boolean; display?: CardDisplayConfig }) {
  return (
    <div
      className={`${CARD_SHELL} scale-[1.03] rotate-1 cursor-grabbing !shadow-modal ring-1 ring-accent/30 ${compact ? "px-2.5 py-2" : "p-3"}`}
    >
      <TaskCardBody task={task} compact={compact} display={display} />
    </div>
  );
}
