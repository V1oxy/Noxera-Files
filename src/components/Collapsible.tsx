import { ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface CollapsibleProps {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Expands/collapses `children` to their real measured height rather than a
 * guessed oversized cap (the common `max-h-[3000px]` trick) - that trick
 * makes expanding look like a "flash open" instead of a smooth grow, since
 * the transition spends almost all its time animating past the real height.
 * Height keeps tracking content size via `ResizeObserver` while expanded, so
 * e.g. adding a row grows the panel smoothly too instead of snapping.
 */
export function Collapsible({ collapsed, children, className = "" }: CollapsibleProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const sync = () => {
      if (!collapsed) setHeight(el.scrollHeight);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed]);

  return (
    <div
      style={{ maxHeight: collapsed ? 0 : height, transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
      className={`overflow-hidden transition-[max-height,opacity] duration-300 ${collapsed ? "opacity-0" : "opacity-100"} ${className}`}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/** A single chevron that rotates 90° (rather than swapping between two
 * separate icon glyphs) between its collapsed (pointing right) and expanded
 * (pointing down) states, with a light spring overshoot - purely decorative,
 * so the bounce never touches layout/reflow the way animating height does. */
export function CollapseChevron({ collapsed, size = 12, className = "" }: { collapsed: boolean; size?: number; className?: string }) {
  return (
    <ChevronRight
      size={size}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      className={`shrink-0 transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-90"} ${className}`}
    />
  );
}
