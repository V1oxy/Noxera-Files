import type { LucideIcon } from "lucide-react";
import { Check, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon: LucideIcon;
  /** Omit when `submenu` is set - a submenu parent only ever opens its
   * children, it never fires an action of its own. */
  onClick?: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
  /** Marks this item as the currently active choice within a submenu (e.g.
   * the task's current status), shown with a checkmark. */
  active?: boolean;
  /** Nested items shown in a flyout panel on hover, instead of firing
   * `onClick` directly - e.g. "Change status" -> one item per status. */
  submenu?: ContextMenuItem[];
}

interface MenuPanelProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (item: ContextMenuItem) => void;
  /** Every currently-mounted panel (this one and any open submenu) registers
   * its own root DOM node here, so the top-level outside-click check can
   * treat a click anywhere in the whole (possibly multi-panel) menu as
   * "inside" - see the note on why each panel portals independently below. */
  registry: Set<HTMLElement>;
}

function MenuPanel({ x, y, items, onSelect, registry }: MenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, visible: false });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    setPos({ left, top, visible: true });
  }, [x, y]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    registry.add(el);
    return () => {
      registry.delete(el);
    };
  }, [registry]);

  return createPortal(
    <div
      ref={ref}
      style={{ left: pos.left, top: pos.top, opacity: pos.visible ? 1 : 0 }}
      className="animate-scale-in fixed z-[90] w-52 rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple"
    >
      {items.map((item, i) => {
        const anchor = itemRefs.current[i];
        return (
          <div key={item.label} onMouseEnter={() => setOpenIndex(item.submenu ? i : null)}>
            {item.dividerBefore && <div className="my-1 h-px bg-surface-border" />}
            <button
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onClick={(e) => {
                // ContextMenu is portaled to document.body, but React bubbles
                // synthetic events along the *component* tree, not the DOM
                // tree - without stopping it here, this click would also
                // bubble up through whichever row rendered this menu (e.g.
                // FileRow's onClick opens version history on every click,
                // including this one) and fire alongside the intended action.
                e.stopPropagation();
                if (item.submenu) {
                  setOpenIndex(i);
                  return;
                }
                onSelect(item);
              }}
              className={`flex w-full items-center gap-2.5 rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                item.danger
                  ? "text-danger hover:bg-danger/10"
                  : "text-label-primary hover:bg-accent hover:text-white"
              }`}
            >
              <item.icon size={14} strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.active && <Check size={13} strokeWidth={2} className="shrink-0" />}
              {item.submenu && <ChevronRight size={13} strokeWidth={2} className="shrink-0" />}
            </button>
            {item.submenu && openIndex === i && anchor && (
              <MenuPanel
                x={anchor.getBoundingClientRect().right + 2}
                y={anchor.getBoundingClientRect().top}
                items={item.submenu}
                onSelect={onSelect}
                registry={registry}
              />
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  // A ref (not state) - membership changes as submenus open/close, but
  // that alone should never trigger a re-render here.
  const registry = useRef<Set<HTMLElement>>(new Set()).current;

  useLayoutEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = Array.from(registry).some((el) => el.contains(target));
      if (!insideMenu) onClose();
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
  }, [onClose, registry]);

  return (
    <MenuPanel
      x={x}
      y={y}
      items={items}
      onSelect={(item) => {
        onClose();
        item.onClick?.();
      }}
      registry={registry}
    />
  );
}
