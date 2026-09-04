import type { LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, visible: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    setPos({ left, top, visible: true });
  }, [x, y]);

  useLayoutEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ left: pos.left, top: pos.top, opacity: pos.visible ? 1 : 0 }}
      className="animate-scale-in fixed z-[90] w-52 rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple"
    >
      {items.map((item, i) => (
        <div key={item.label}>
          {item.dividerBefore && <div className="my-1 h-px bg-surface-border" />}
          <button
            onClick={() => {
              onClose();
              item.onClick();
            }}
            className={`flex w-full items-center gap-2.5 rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
              item.danger
                ? "text-danger hover:bg-danger/10"
                : "text-label-primary hover:bg-accent hover:text-white"
            }`}
          >
            <item.icon size={14} strokeWidth={1.75} />
            {item.label}
          </button>
          {i === items.length - 1 && null}
        </div>
      ))}
    </div>,
    document.body,
  );
}
