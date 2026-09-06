import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderClosed } from "lucide-react";

import { FileCountBadge, PinIndicator, PriorityBadge, UpdateIndicator, DueBadge } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
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

export function TaskCard({ task, compact, display = DEFAULT_DISPLAY, priorities, onOpen }: TaskCardProps) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`group cursor-default rounded-apple border border-surface-border bg-surface-card shadow-card transition-colors hover:bg-surface-card-hover ${
        compact ? "px-2.5 py-2" : "p-3"
      } ${task.archived ? "opacity-50" : ""}`}
    >
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

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {display.showPriority && <PriorityBadge priority={task.priority} priorities={priorities} />}
        {display.showUpdateIndicator && task.hasUnseenUpdate && <UpdateIndicator />}
        {display.showDueDate && <DueBadge task={task} />}
      </div>

      {(display.showAssignee && task.assignee) || (display.showFileCount && task.fileCount > 0) ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {display.showAssignee && task.assignee ? (
            <span className="min-w-0 truncate text-[11px] text-label-tertiary" title={t("tracker.assignee")}>
              {task.assignee}
            </span>
          ) : (
            <span />
          )}
          {display.showFileCount && <FileCountBadge count={task.fileCount} />}
        </div>
      ) : null}
    </div>
  );
}
