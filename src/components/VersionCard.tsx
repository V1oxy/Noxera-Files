import { Download, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/Button";
import type { FileVersion } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

interface VersionCardProps {
  version: FileVersion;
  isCurrent: boolean;
  onDownload: (version: FileVersion) => void;
  onRestore: (version: FileVersion) => void;
  onDelete: (version: FileVersion) => void;
}

export function VersionCard({ version, isCurrent, onDownload, onRestore, onDelete }: VersionCardProps) {
  return (
    <div
      className={`rounded-apple border p-3 ${
        isCurrent ? "border-accent/40 bg-accent/[0.06]" : "border-surface-border bg-surface-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-label-primary">v{version.versionNumber}</span>
          {isCurrent && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
              Current
            </span>
          )}
        </div>
        <span className="text-[11.5px] text-label-tertiary">{formatBytes(version.fileSize)}</span>
      </div>

      <p className="mt-1 text-[11.5px] text-label-secondary">{formatFullDateTime(version.createdAt)}</p>

      {version.description && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-label-primary">{version.description}</p>
      )}

      <div className="mt-2.5 flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => onDownload(version)}>
          <Download size={13} />
          Download
        </Button>
        {!isCurrent && (
          <Button size="sm" variant="secondary" onClick={() => onRestore(version)}>
            <RotateCcw size={13} />
            Restore
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => onDelete(version)}>
          <Trash2 size={13} />
          Delete
        </Button>
      </div>
    </div>
  );
}
