import { Upload, X } from "lucide-react";

import { Button } from "@/components/Button";
import { VersionCard } from "@/components/VersionCard";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileDetail, FileVersion } from "@/types";

interface VersionHistoryProps {
  open: boolean;
  detail: FileDetail | null;
  loading: boolean;
  onClose: () => void;
  onUploadNewVersion: () => void;
  onDownload: (version: FileVersion) => void;
  onRestore: (version: FileVersion) => void;
  onDelete: (version: FileVersion) => void;
}

export function VersionHistory({
  open,
  detail,
  loading,
  onClose,
  onUploadNewVersion,
  onDownload,
  onRestore,
  onDelete,
}: VersionHistoryProps) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-drop-target={detail ? "file" : undefined}
        data-row-id={detail?.id}
        className="animate-scale-in flex max-h-[80vh] w-[480px] flex-col rounded-apple-lg border border-surface-border bg-surface-modal shadow-modal backdrop-blur-apple"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-label-primary">
              {detail?.name ?? t("history.subtitle")}
            </h2>
            <p className="text-[12px] text-label-secondary">{t("history.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="no-drag shrink-0 rounded-full p-1 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {loading && <p className="text-[12.5px] text-label-secondary">{t("files.loading")}</p>}
          {!loading &&
            detail?.versions.map((v) => (
              <VersionCard
                key={v.id}
                version={v}
                isCurrent={v.id === detail.currentVersionId}
                onDownload={onDownload}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))}
        </div>

        <div className="border-t border-surface-border px-5 py-3.5">
          <Button variant="primary" onClick={onUploadNewVersion} className="w-full">
            <Upload size={14} />
            {t("history.uploadNewVersion")}
          </Button>
        </div>
      </div>
    </div>
  );
}
