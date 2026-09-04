import { ChevronRight } from "lucide-react";

export interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

interface BreadcrumbProps {
  entries: BreadcrumbEntry[];
  onNavigate: (id: string | null) => void;
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
              <button
                onClick={() => !isLast && onNavigate(entry.id)}
                disabled={isLast}
                className={`max-w-[220px] truncate rounded px-1 py-0.5 ${
                  isLast ? "font-medium text-label-primary" : "hover:bg-black/[0.05] hover:text-label-primary dark:hover:bg-white/[0.06]"
                }`}
              >
                {entry.name}
              </button>
            </span>
          );
        })}
    </div>
  );
}
