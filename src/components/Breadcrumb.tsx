import { useDroppable } from "@dnd-kit/core";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

interface BreadcrumbProps {
  entries: BreadcrumbEntry[];
  onNavigate: (id: string | null) => void;
}

const CRUMB_PREFIX = "crumb:";

/** dnd-kit droppable id for a breadcrumb entry - `null` (the project root)
 * needs a stand-in string since dnd-kit ids can't be null themselves. */
export function crumbDroppableId(id: string | null): string {
  return CRUMB_PREFIX + (id ?? "root");
}

/** The reverse of `crumbDroppableId` - `undefined` when `overId` isn't a
 * breadcrumb drop at all (a folder/file row id, most commonly), so callers
 * can tell "not a crumb" apart from "the root crumb" (which resolves to
 * `null`, a legitimate move target meaning "the project's top level"). */
export function parseCrumbDroppableId(overId: string): string | null | undefined {
  if (!overId.startsWith(CRUMB_PREFIX)) return undefined;
  const raw = overId.slice(CRUMB_PREFIX.length);
  return raw === "root" ? null : raw;
}

function Crumb({ entry, isLast, onNavigate }: { entry: BreadcrumbEntry; isLast: boolean; onNavigate: (id: string | null) => void }) {
  // Every ancestor crumb but the current folder itself is a valid drop
  // target for "move this file/folder back up a level" - the current
  // folder's own crumb is excluded since dropping there would just be a
  // no-op (the item is already inside it).
  const { setNodeRef, isOver } = useDroppable({ id: crumbDroppableId(entry.id), disabled: isLast });

  return (
    <button
      ref={setNodeRef}
      onClick={() => !isLast && onNavigate(entry.id)}
      disabled={isLast}
      className={`max-w-[220px] truncate rounded px-1 py-0.5 transition-colors ${
        isLast
          ? "font-medium text-label-primary"
          : isOver
            ? "bg-accent text-white"
            : "hover:bg-black/[0.05] hover:text-label-primary dark:hover:bg-white/[0.06]"
      }`}
    >
      {entry.name}
    </button>
  );
}

/**
 * Always occupies the same box (fixed height, no vertical padding growth) so
 * that opening/closing a folder never shifts the toolbar below it - the area
 * just sits empty at the project root instead of collapsing to 0px.
 */
export function Breadcrumb({ entries, onNavigate }: BreadcrumbProps) {
  const showTrail = entries.length > 1;

  return (
    <div className="no-drag flex h-[26px] shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden px-6 text-[12.5px] text-label-secondary [scrollbar-width:thin]">
      {showTrail &&
        entries.map((entry, i) => {
          const isLast = i === entries.length - 1;
          return (
            <span key={entry.id ?? "root"} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="shrink-0 text-label-tertiary" />}
              <Crumb entry={entry} isLast={isLast} onNavigate={onNavigate} />
            </span>
          );
        })}
    </div>
  );
}
