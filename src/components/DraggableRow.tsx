import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface DraggableRowProps {
  id: string;
  children: ReactNode;
  className?: string;
  /** True when the caller also renders a `DragOverlay` clone of this row -
   * see the same flag on `SortableRow` for why: it keeps the dragged item
   * from appearing twice once its own transform can travel outside a
   * clipped scroll container. */
  dragOverlayActive?: boolean;
}

/**
 * Folder rows are both a drag source (move this folder into another one)
 * and a drop target (move something else into this one) - plain
 * useDraggable + useDroppable rather than SortableRow's useSortable, since
 * folders never reorder against each other by drag, only nest. That keeps
 * a folder's rect static for the whole drag instead of sliding around in a
 * "make room" reorder preview, which is what a sortable strategy would do
 * and would fight any attempt to detect "hovering over this folder."
 */
export function DraggableRow({ id, children, className = "", dragOverlayActive = false }: DraggableRowProps) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef } = useDroppable({ id });
  const placeholder = isDragging && dragOverlayActive;

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={`sortable-row ${className} ${isDragging ? "z-10" : ""} ${
        isDragging && !dragOverlayActive ? "opacity-50" : ""
      } ${placeholder ? "rounded-apple border-2 border-dashed border-accent/35 bg-accent/[0.05]" : ""}`}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
    >
      <div className={placeholder ? "opacity-0" : ""}>{children}</div>
    </div>
  );
}
