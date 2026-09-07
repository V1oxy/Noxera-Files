import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional swatch dot rendered before the label (status/priority/label colors). */
  color?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes merged onto the trigger button - use to match a
   * surrounding input's sizing (height/padding/rounding). */
  className?: string;
  /** Renders as a small rounded pill (status/priority chips) instead of a
   * standard bordered field. */
  variant?: "field" | "pill";
  /** Fill the parent's width, like a native `<select>` normally does -
   * default on for "field" (form rows expect that), off for "pill" (chips
   * size to their label). Set to false for an inline filter-bar dropdown
   * that should size to its content instead - a plain `className="w-..."`
   * override can't reliably beat this component's own width class since
   * Tailwind's generated CSS order isn't the same as class-string order. */
  fullWidth?: boolean;
}

const FIELD_TRIGGER_CLASS =
  "rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary dark:bg-white/[0.05]";
const PILL_TRIGGER_CLASS =
  "rounded-full bg-black/[0.05] py-1 pl-2.5 pr-7 text-[11.5px] font-medium text-label-primary hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]";

/**
 * A custom-rendered single-select dropdown, standing in for the native
 * `<select>` app-wide (see the tracker/settings audit for why: WebView2's
 * native option-list popup follows the OS theme rather than this app's own
 * light/dark setting, and a `<select>`'s native focus ring resists
 * `outline-none` far more stubbornly than an ordinary button - both show up
 * as "unreadable / too heavy" reports on every dropdown in the app, not any
 * one of them). Portal-rendered (like ContextMenu) so it's never clipped by
 * a scrollable/overflow-hidden ancestor (modals bodies, panels, ...).
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
  variant = "field",
  fullWidth = variant === "field",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null);

  function openMenu() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setPos({ left: rect.left, top: openUp ? rect.top - 4 : rect.bottom + 4, width: rect.width, openUp });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const triggerClass = variant === "pill" ? PILL_TRIGGER_CLASS : FIELD_TRIGGER_CLASS;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`relative flex items-center gap-1.5 text-left outline-none transition-colors focus-visible:border-accent/50 disabled:cursor-default disabled:opacity-50 ${triggerClass} ${
          fullWidth ? "w-full" : ""
        } ${variant === "field" ? "pr-7" : ""} ${className}`}
      >
        {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : <span className="text-label-tertiary">{placeholder}</span>}</span>
        <ChevronDown
          size={variant === "pill" ? 11 : 13}
          className={`pointer-events-none absolute ${variant === "pill" ? "right-2" : "right-2.5"} top-1/2 -translate-y-1/2 shrink-0 text-label-tertiary`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[95]" onMouseDown={() => setOpen(false)} onContextMenu={() => setOpen(false)} />
            <div
              style={{ left: pos.left, top: pos.top, minWidth: pos.width, transform: pos.openUp ? "translateY(-100%)" : undefined }}
              className="animate-scale-in fixed z-[96] max-h-64 min-w-[140px] overflow-y-auto rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple"
            >
              {options.length === 0 && <p className="px-2.5 py-1.5 text-[12px] text-label-tertiary">—</p>}
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    opt.value === value ? "bg-accent/[0.12] text-accent" : "text-label-primary hover:bg-accent hover:text-white"
                  }`}
                >
                  {opt.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
