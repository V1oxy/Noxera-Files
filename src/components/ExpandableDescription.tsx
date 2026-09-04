import { useLayoutEffect, useRef, useState } from "react";

import { useLanguage } from "@/hooks/useLanguage";

interface ExpandableDescriptionProps {
  text: string | null | undefined;
  /** Wrapper element classes (layout only - width, margins). */
  className?: string;
  /** Classes applied to the text itself (font size, color, line-height...). Must stay identical between the collapsed and measurement copies. */
  textClassName?: string;
  /** How many lines to show before offering "Show more". */
  collapsedLines?: number;
  /** Max height (px) the block may grow to once expanded; beyond that an internal scrollbar appears. */
  expandedMaxHeight?: number;
  /** Shown (muted) instead of the toggle/body when there is no text at all. */
  emptyPlaceholder?: string;
}

/**
 * Single reusable "long text" block used for project/file/version
 * descriptions everywhere in the app.
 *
 * Collapsed state clamps to `collapsedLines` lines. The cutoff is computed in
 * JS (not CSS line-clamp) so the shortened text always ends at a real word
 * boundary and with ".." instead of the browser's "…" - both are spec
 * requirements CSS truncation can't satisfy on its own. The cut point is
 * re-measured against the element's actual rendered width, so it adapts to
 * window resizes, sidebar toggles, etc.
 *
 * Expanded state grows the block up to `expandedMaxHeight` and scrolls
 * internally past that - it never pushes the rest of the page around.
 */
export function ExpandableDescription({
  text,
  className = "",
  textClassName = "",
  collapsedLines = 3,
  expandedMaxHeight = 220,
  emptyPlaceholder,
}: ExpandableDescriptionProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [clamp, setClamp] = useState<{ display: string; truncated: boolean }>({
    display: text ?? "",
    truncated: false,
  });

  const value = text ?? "";

  useLayoutEffect(() => {
    if (!value) {
      setClamp({ display: "", truncated: false });
      return;
    }

    const container = containerRef.current;
    const measurer = measureRef.current;
    if (!container || !measurer) return;

    function recompute() {
      const el = measurer;
      const style = window.getComputedStyle(el as HTMLParagraphElement);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
      const maxHeight = lineHeight * collapsedLines + 1;

      el!.textContent = value;
      if (el!.scrollHeight <= maxHeight) {
        setClamp({ display: value, truncated: false });
        return;
      }

      let lo = 0;
      let hi = value.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        el!.textContent = value.slice(0, mid) + "..";
        if (el!.scrollHeight <= maxHeight) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }

      let cut = lo;
      const slice = value.slice(0, cut);
      // Back off to the end of the previous whole word, unless the fitting
      // slice has no word boundary at all (one long unbroken run of
      // characters) - then there is nothing better to cut at.
      const boundary = /[\s ]+(?=[^\s ]*$)/.exec(slice);
      if (boundary && boundary.index > 0) {
        cut = boundary.index;
      }
      const trimmed = value.slice(0, cut).replace(/[\s.,;:!?-]+$/, "");
      setClamp({ display: `${trimmed}..`, truncated: true });
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [value, collapsedLines]);

  if (!value) {
    return emptyPlaceholder ? (
      <p className={`${textClassName} italic text-label-tertiary`}>{emptyPlaceholder}</p>
    ) : null;
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      {/* Off-screen twin used only to measure where the collapsed cut lands; never shown. */}
      <p
        ref={measureRef}
        aria-hidden
        className={textClassName}
        style={{
          position: "absolute",
          visibility: "hidden",
          top: 0,
          left: 0,
          right: 0,
          height: "auto",
          maxHeight: "none",
          margin: 0,
          pointerEvents: "none",
          zIndex: -1,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      />

      {expanded ? (
        <div
          className="overflow-y-auto overflow-x-hidden pr-1"
          style={{ maxHeight: expandedMaxHeight }}
        >
          <p
            className={textClassName}
            style={{ overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "pre-wrap" }}
          >
            {value}
          </p>
        </div>
      ) : (
        <p
          className={textClassName}
          style={{ overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "pre-wrap" }}
        >
          {clamp.display}
        </p>
      )}

      {clamp.truncated && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="no-drag mt-0.5 text-[11px] font-medium text-accent hover:underline"
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}
