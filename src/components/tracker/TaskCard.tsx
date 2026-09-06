import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderClosed } from "lucide-react";

import { FileCountBadge, PinIndicator, PriorityBadge, UpdateIndicator, DueBadge } from "@/components/tracker/shared";
import type { CardDisplayConfig, PriorityConfig, TrackerTask } from "@/types";

interface TaskCardProps {
  task: TrackerTask;
  compact: boolean;
  display?: CardDisplayConfig;
  priorities?: Record<string, PriorityConfig>;
  onOpen: (task: TrackerTask) => void;
}

const DEFAULT_DISPLAY: CardDisplayConfig = {
  showProject: true,
  showPriority: true,
  showDueDate: true,
  showAssignee: true,
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

      {display.showProject && task.projectName && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-label-secondary">
          <FolderClosed size={11} className="shrink-0" />
          <span className="truncate">{task.projectName}</span>
        </p>
      )}

      {!compact && task.description && (
        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-label-secondary">{task.description}</p>
      )}

      {(display.showPriority || (display.showUpdateIndicator && task.hasUnseenUpdate) || display.showDueDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {display.showPriority && <PriorityBadge priority={task.priority} />}
          {display.showUpdateIndicator && task.hasUnseenUpdate && <UpdateIndicator />}
          {display.showDueDate && <DueBadge task={task} />}
        </div>
      )}

      {display.showFileCount && task.fileCount > 0 && (
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

export function TaskCard({ task, compact, display = DEFAULT_DISPLAY, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
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
      className={`group cursor-grab touch-none select-none active:cursor-grabbing ${CARD_SHELL} hover:border-surface-border hover:bg-surface-card-hover hover:shadow-popover ${
        compact ? "px-2.5 py-2" : "p-3"
      } ${task.archived ? "opacity-50" : ""}`}
    >
      <TaskCardBody task={task} compact={compact} display={display} />
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
