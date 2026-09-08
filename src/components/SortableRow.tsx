import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

interface SortableRowProps {
  id: string;
  children: ReactNode;
  className?: string;
  /** True when the caller also renders a `DragOverlay` clone of this row -
   * in that case the row being dragged shows an empty dashed placeholder
   * (its content hidden, not the row itself) instead of dimming to 50%,
   * since the overlay is what's meant to be seen following the cursor.
   * Without this a row whose own transform can travel outside a clipped
   * scroll container (see FileList, dragging up to the breadcrumb) would
   * show two overlapping copies of itself. */
  dragOverlayActive?: boolean;
}

/**
 * Thin drag handle wrapper around an existing row (project button, folder
 * row, file row) that turns the whole row into a dnd-kit sortable item
 * without touching that row's own markup or click/context-menu handling.
 *
 * dnd-kit only starts a drag once the pointer has moved past its activation
 * distance (configured on the sensor), so an ordinary click still reaches
 * the wrapped row's own onClick untouched - dragging never fires it.
 */
export function SortableRow({ id, children, className = "", dragOverlayActive = false }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const placeholder = isDragging && dragOverlayActive;

  return (
    <div
      ref={setNodeRef}
      className={`sortable-row ${className} ${isDragging ? "z-10" : ""} ${
        placeholder ? "rounded-apple border-2 border-dashed border-accent/35 bg-accent/[0.05]" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !dragOverlayActive ? 0.5 : 1,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
    >
      <div className={placeholder ? "opacity-0" : ""}>{children}</div>
    </div>
  );
}
