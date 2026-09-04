import { ChevronRight } from "lucide-react";

export interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

interface BreadcrumbProps {
  entries: BreadcrumbEntry[];
  onNavigate: (id: string | null) => void;
}

export function Breadcrumb({ entries, onNavigate }: BreadcrumbProps) {
  if (entries.length <= 1) return null;

  return (
    <div className="no-drag flex min-w-0 items-center gap-1 px-6 pb-1 text-[12.5px] text-label-secondary">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        return (
          <span key={entry.id ?? "root"} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-label-tertiary" />}
            <button
              onClick={() => !isLast && onNavigate(entry.id)}
              disabled={isLast}
              className={`truncate rounded px-1 py-0.5 ${
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
