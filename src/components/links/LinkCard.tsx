import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { ContextMenu } from "@/components/ContextMenu";
import { useLanguage } from "@/hooks/useLanguage";
import type { Link } from "@/types";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const CARD_SHELL =
  "rounded-apple border border-surface-border bg-surface-card p-3 shadow-card transition-[background-color,border-color,box-shadow] duration-150";

function LinkCardBody({ link, showProject }: { link: Link; showProject: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/[0.12] text-accent">
        <Link2 size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-label-primary">{link.title}</p>
        {link.description && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-label-secondary">{link.description}</p>}
        <p className="mt-1 truncate text-[11px] text-label-tertiary">
          {domainOf(link.url)}
          {showProject && ` · ${link.projectName}`}
        </p>
      </div>
    </div>
  );
}

interface LinkCardProps {
  link: Link;
  showProject?: boolean;
  onOpen: (link: Link) => void;
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
}

export function LinkCard({ link, showProject = false, onOpen, onEdit, onDelete }: LinkCardProps) {
  const { t } = useLanguage();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  };

  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="h-[68px] rounded-apple border-2 border-dashed border-accent/35 bg-accent/[0.05]" />;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => onOpen(link)}
      className={`group relative cursor-grab touch-none select-none active:cursor-grabbing ${CARD_SHELL} hover:border-surface-border hover:bg-surface-card-hover hover:shadow-popover`}
    >
      <LinkCardBody link={link} showProject={showProject} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="no-drag absolute right-2 top-2 shrink-0 rounded-apple-sm p-1 text-label-tertiary opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-label-primary group-hover:opacity-100 dark:hover:bg-white/[0.1]"
      >
        <MoreHorizontal size={15} />
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: t("menu.open"), icon: ExternalLink, onClick: () => onOpen(link) },
            { label: t("menu.edit"), icon: Pencil, onClick: () => onEdit(link) },
            { label: t("menu.delete"), icon: Trash2, onClick: () => onDelete(link), danger: true, dividerBefore: true },
          ]}
        />
      )}
    </div>
  );
}

export function LinkCardOverlay({ link, showProject = false }: { link: Link; showProject?: boolean }) {
  return (
    <div className={`${CARD_SHELL} scale-[1.03] rotate-1 cursor-grabbing !shadow-modal ring-1 ring-accent/30`}>
      <LinkCardBody link={link} showProject={showProject} />
    </div>
  );
}
