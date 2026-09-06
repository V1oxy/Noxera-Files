import { Paperclip, Pin, RefreshCw } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import { formatFullDateTime } from "@/utils/format";

export function PriorityBadge({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium ${className}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
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
