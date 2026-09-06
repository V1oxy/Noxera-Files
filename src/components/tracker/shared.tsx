import { Paperclip, Pin, RefreshCw } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import type { Priority, PriorityConfig, TrackerTask } from "@/types";
import { formatFullDateTime } from "@/utils/format";

export const DEFAULT_PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  low: { label: "Low", color: "#8E8E93" },
  normal: { label: "Normal", color: "#0A84FF" },
  high: { label: "High", color: "#FF9F0A" },
  critical: { label: "Critical", color: "#FF453A" },
};

export function priorityConfig(priority: Priority, priorities?: Record<string, PriorityConfig>): PriorityConfig {
  return priorities?.[priority] ?? DEFAULT_PRIORITY_CONFIG[priority];
}

export function PriorityDot({
  priority,
  priorities,
  size = 7,
}: {
  priority: Priority;
  priorities?: Record<string, PriorityConfig>;
  size?: number;
}) {
  const cfg = priorityConfig(priority, priorities);
  return (
    <span
      title={cfg.label}
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: cfg.color }}
    />
  );
}

export function PriorityBadge({
  priority,
  priorities,
  className = "",
}: {
  priority: Priority;
  priorities?: Record<string, PriorityConfig>;
  className?: string;
}) {
  const cfg = priorityConfig(priority, priorities);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium ${className}`}
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export function StatusPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

function isOverdue(task: Pick<TrackerTask, "dueAt" | "completedAt">): boolean {
  return !!task.dueAt && !task.completedAt && task.dueAt < new Date().toISOString();
}

export { isOverdue };

export function overdueDays(dueAt: string): number {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

/** "Deadline: 08.09.2026" / "Overdue by 2 days", localized, color-coded when late. */
export function DueBadge({ task, className = "" }: { task: TrackerTask; className?: string }) {
  const { t, locale } = useLanguage();
  if (!task.dueAt) return null;
  const overdue = isOverdue(task);
  const date = new Date(task.dueAt).toLocaleDateString(locale);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? "font-medium text-danger" : "text-label-secondary"} ${className}`}>
      {overdue ? t("tracker.overdueBy", { count: overdueDays(task.dueAt) }) : t("tracker.dueOn", { date })}
    </span>
  );
}

export function FileCountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-label-tertiary ${className}`}>
      <Paperclip size={11} />
      {count}
    </span>
  );
}

export function UpdateIndicator({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-accent/[0.12] px-1.5 py-0.5 text-[10.5px] font-medium text-accent ${className}`}>
      <RefreshCw size={10} />
      {t("tracker.fileUpdated")}
    </span>
  );
}

export function PinIndicator({ size = 11, className = "" }: { size?: number; className?: string }) {
  return <Pin size={size} className={`shrink-0 fill-current text-label-tertiary ${className}`} />;
}

export function formatEventTime(iso: string, locale: string): string {
  return formatFullDateTime(iso, locale);
}
