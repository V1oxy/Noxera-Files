import {
  Download,
  ExternalLink,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { ContextMenu } from "@/components/ContextMenu";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import type { FileEntry } from "@/types";
import { formatBytes, formatModified } from "@/utils/format";

interface FileRowActions {
  onOpen: (file: FileEntry) => void;
  onDownload: (file: FileEntry) => void;
  onUploadNewVersion: (file: FileEntry) => void;
  onViewHistory: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
}

export function FileRow({ file, ...actions }: { file: FileEntry } & FileRowActions) {
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
      onDoubleClick={() => actions.onViewHistory(file)}
      className="group flex items-center gap-3 rounded-apple-sm px-3 py-2.5 transition-colors hover:bg-surface-card-hover"
    >
      <FileTypeIcon filename={file.currentVersion?.originalFilename ?? file.name} size={22} />

      <div className="min-w-0 flex-1 cursor-default" onClick={() => actions.onViewHistory(file)}>
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-medium text-label-primary">{file.name}</p>
          {file.currentVersion && (
            <span className="shrink-0 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10.5px] font-medium text-label-secondary dark:bg-white/[0.08]">
              v{file.currentVersion.versionNumber}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-label-secondary">
          {file.currentVersion
            ? `Modified ${formatModified(file.currentVersion.createdAt)} · ${formatBytes(file.currentVersion.fileSize)}`
            : "No versions"}
        </p>
      </div>

      <button
        onClick={(e) => {
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
            { label: "Open", icon: ExternalLink, onClick: () => actions.onOpen(file) },
            { label: "Download", icon: Download, onClick: () => actions.onDownload(file) },
            { label: "Upload New Version", icon: Upload, onClick: () => actions.onUploadNewVersion(file) },
            { label: "Version History", icon: History, onClick: () => actions.onViewHistory(file), dividerBefore: true },
            { label: "Rename", icon: Pencil, onClick: () => actions.onRename(file), dividerBefore: true },
            { label: "Delete", icon: Trash2, onClick: () => actions.onDelete(file), danger: true, dividerBefore: true },
          ]}
        />
      )}
    </div>
  );
}
