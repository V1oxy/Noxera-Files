import { Paperclip } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge, StatusPill, UpdateIndicator } from "@/components/tracker/shared";
import { useLanguage } from "@/hooks/useLanguage";
import { useProjectTrackerTasks } from "@/hooks/useTracker";

interface ProjectTasksTabProps {
  projectId: string;
  onOpenTask: (taskId: string) => void;
}

export function ProjectTasksTab({ projectId, onOpenTask }: ProjectTasksTabProps) {
  const { t } = useLanguage();
  const { tasks, loading } = useProjectTrackerTasks(projectId);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {loading && <p className="px-2 py-4 text-[12.5px] text-label-secondary">{t("files.loading")}</p>}
      {!loading && tasks.length === 0 && <EmptyState title={t("tracker.noProjectTasksTitle")} description={t("tracker.noProjectTasksDescription")} />}
      <div className="space-y-1">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onOpenTask(task.id)}
            className="flex w-full items-center gap-3 rounded-apple-sm px-3 py-2.5 text-left transition-colors hover:bg-surface-card-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-label-primary">{task.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-label-secondary">{task.boardName}</p>
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
  );
}
