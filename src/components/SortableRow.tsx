import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

interface SortableRowProps {
  id: string;
  children: ReactNode;
  className?: string;
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
export function SortableRow({ id, children, className = "" }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`sortable-row ${className} ${isDragging ? "z-10" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
