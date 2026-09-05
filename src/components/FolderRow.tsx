import { Folder as FolderIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { ContextMenu } from "@/components/ContextMenu";
import { useLanguage } from "@/hooks/useLanguage";
import type { Folder } from "@/types";

interface FolderRowProps {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  isDropTarget?: boolean;
}

export function FolderRow({ folder, onOpen, onRename, onDelete, isDropTarget }: FolderRowProps) {
  const { t } = useLanguage();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const itemCount = folder.folderCount + folder.fileCount;

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={() => onOpen(folder)}
      onClick={() => onOpen(folder)}
      className={`group flex cursor-default items-center gap-3 rounded-apple-sm px-3 py-2.5 transition-all duration-150 ease-out hover:bg-surface-card-hover ${
        isDropTarget ? "bg-accent/[0.12] ring-1 ring-accent/50" : ""
      }`}
    >
      <FolderIcon size={22} strokeWidth={1.5} className="fill-accent/15 text-accent" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-label-primary">{folder.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-label-secondary">
          {itemCount === 0 ? t("folder.empty") : t("folder.itemCount", { count: itemCount })}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="no-drag shrink-0 rounded-apple-sm p-1.5 text-label-tertiary opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-label-primary group-hover:opacity-100 dark:hover:bg-white/[0.1]"
      >
        <MoreHorizontal size={16} />
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: t("menu.rename"), icon: Pencil, onClick: () => onRename(folder) },
            { label: t("menu.delete"), icon: Trash2, onClick: () => onDelete(folder), danger: true, dividerBefore: true },
          ]}
        />
      )}
    </div>
  );
}
