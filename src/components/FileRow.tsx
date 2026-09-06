import {
  Download,
  ExternalLink,
  History,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { ContextMenu } from "@/components/ContextMenu";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileEntry } from "@/types";
import { formatBytes, formatModified } from "@/utils/format";

interface FileRowActions {
  onOpen: (file: FileEntry) => void;
  onDownload: (file: FileEntry) => void;
  onUploadNewVersion: (file: FileEntry) => void;
  onViewHistory: (file: FileEntry) => void;
  onShowWhatsNew: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onCreateTask: (file: FileEntry) => void;
}

export function FileRow({
  file,
  isDropTarget,
  ...actions
}: { file: FileEntry; isDropTarget?: boolean } & FileRowActions) {
  const { t, locale } = useLanguage();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function openMenuAt(x: number, y: number) {
    setMenu({ x, y });
  }

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
      onClick={() => actions.onViewHistory(file)}
      className={`group flex cursor-default items-center gap-3 rounded-apple-sm px-3 py-2.5 transition-colors hover:bg-surface-card-hover ${
        isDropTarget ? "bg-accent/[0.12] ring-1 ring-accent/50" : ""
      }`}
    >
      <FileTypeIcon filename={file.currentVersion?.originalFilename ?? file.name} size={22} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-medium text-label-primary">{file.name}</p>
          {file.currentVersion && (
            <button
              type="button"
              title={t("menu.whatsNew")}
              onClick={(e) => {
                e.stopPropagation();
                actions.onShowWhatsNew(file);
              }}
              className="no-drag shrink-0 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-medium text-label-secondary transition-colors hover:bg-accent hover:text-white dark:bg-white/[0.08]"
            >
              v{file.currentVersion.versionNumber}
            </button>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-label-secondary">
          {file.currentVersion
            ? t("files.modified", {
                date: formatModified(file.currentVersion.createdAt, locale, t("common.today"), t("common.yesterday")),
                size: formatBytes(file.currentVersion.fileSize),
              })
            : t("files.noVersions")}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          openMenuAt(rect.left, rect.bottom + 4);
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
            { label: t("menu.open"), icon: ExternalLink, onClick: () => actions.onOpen(file) },
            { label: t("menu.download"), icon: Download, onClick: () => actions.onDownload(file) },
            { label: t("menu.uploadNewVersion"), icon: Upload, onClick: () => actions.onUploadNewVersion(file) },
            { label: t("menu.whatsNew"), icon: Sparkles, onClick: () => actions.onShowWhatsNew(file), dividerBefore: true },
            { label: t("menu.versionHistory"), icon: History, onClick: () => actions.onViewHistory(file) },
            { label: t("tracker.createTaskFromFile"), icon: ListPlus, onClick: () => actions.onCreateTask(file), dividerBefore: true },
            { label: t("menu.rename"), icon: Pencil, onClick: () => actions.onRename(file), dividerBefore: true },
            { label: t("menu.delete"), icon: Trash2, onClick: () => actions.onDelete(file), danger: true, dividerBefore: true },
          ]}
        />
      )}
    </div>
  );
}
