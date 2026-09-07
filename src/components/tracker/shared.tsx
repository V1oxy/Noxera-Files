import { Paperclip, Pin, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/hooks/useLanguage";
import { formatFullDateTime } from "@/utils/format";

/** The fixed palette every status/priority/label picks from - shared so the
 * "edit color" swatch picker (below) always matches what a newly-created
 * one could already be, whether just created or edited afterward. */
export const TRACKER_COLORS = ["#8E8E93", "#0A84FF", "#30D158", "#FF9F0A", "#FF453A", "#BF5AF2", "#64D2FF", "#FFD60A"];

/** A small color dot that opens a swatch picker on click - used to edit the
 * color of an already-created status/priority/label (spec section 1:
 * previously only settable at creation time). Changing the color here
 * applies immediately (the caller's `onChange` persists it), so it's
 * reflected everywhere that color is used (cards, pills, kanban columns)
 * the next time those refetch - no separate propagation step needed since
 * they all read the color live from the same row. */
export function ColorSwatchButton({ color, onChange, size = "h-3.5 w-3.5" }: { color: string; onChange: (color: string) => void; size?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={t("tracker.changeColor")}
        onClick={() => setOpen((v) => !v)}
        className={`${size} shrink-0 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 dark:ring-white/15`}
        style={{ backgroundColor: color }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onMouseDown={() => setOpen(false)} />
          <div className="animate-scale-in absolute left-0 top-6 z-[91] flex flex-wrap gap-1 rounded-apple border border-surface-border bg-surface-modal p-1.5 shadow-popover backdrop-blur-apple" style={{ width: 132 }}>
            {TRACKER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`h-6 w-6 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15 ${c === color ? "ring-2 ring-accent ring-offset-1 ring-offset-surface-modal" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
