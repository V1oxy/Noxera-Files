import { FileUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { VersionCard } from "@/components/VersionCard";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileDetail, FileVersion } from "@/types";

interface VersionHistoryProps {
  open: boolean;
  detail: FileDetail | null;
  loading: boolean;
  isDragActive: boolean;
  dragPosition: { x: number; y: number } | null;
  onClose: () => void;
  onUploadNewVersion: () => void;
  onOpen: (version: FileVersion) => void;
  onDownload: (version: FileVersion) => void;
  onRestore: (version: FileVersion) => void;
  onDelete: (version: FileVersion) => void;
  onEditDescription: (version: FileVersion, description: string) => Promise<void>;
}

export function VersionHistory({
  open,
  detail,
  loading,
  isDragActive,
  dragPosition,
  onClose,
  onUploadNewVersion,
  onOpen,
  onDownload,
  onRestore,
  onDelete,
  onEditDescription,
}: VersionHistoryProps) {
  const { t } = useLanguage();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [hoveringZone, setHoveringZone] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const knownVersionIds = useRef<Set<string> | null>(null);
  const trackedFileId = useRef<string | null>(null);

  useEffect(() => {
    if (!isDragActive || !dragPosition || !dropZoneRef.current) {
      setHoveringZone(false);
      return;
    }
    const rect = dropZoneRef.current.getBoundingClientRect();
    setHoveringZone(
      dragPosition.x >= rect.left &&
        dragPosition.x <= rect.right &&
        dragPosition.y >= rect.top &&
        dragPosition.y <= rect.bottom,
    );
  }, [isDragActive, dragPosition]);

  // Briefly glow whichever version card just appeared, so confirming a drop
  // (which finishes in the separate upload modal, not here) still gives a
  // clear "that worked" moment once the list refreshes with the new version.
  useEffect(() => {
    if (!detail) {
      knownVersionIds.current = null;
      trackedFileId.current = null;
      return;
    }
    const ids = new Set(detail.versions.map((v) => v.id));
    // Switching to a different file's history (useVersions keeps the
    // previous file's `detail` around until the new fetch resolves) - reset
    // the baseline instead of diffing against an unrelated file's versions.
    if (trackedFileId.current !== detail.id) {
      knownVersionIds.current = ids;
      trackedFileId.current = detail.id;
      return;
    }
    if (knownVersionIds.current) {
      const added = detail.versions.find((v) => !knownVersionIds.current!.has(v.id));
      if (added) {
        setJustAddedId(added.id);
        const timer = setTimeout(() => setJustAddedId(null), 1400);
        knownVersionIds.current = ids;
        return () => clearTimeout(timer);
      }
    }
    knownVersionIds.current = ids;
  }, [detail]);

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

        <div ref={dropZoneRef} className="relative flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {loading && <p className="text-[12.5px] text-label-secondary">{t("files.loading")}</p>}
            {!loading &&
              detail?.versions.map((v) => (
                <VersionCard
                  key={v.id}
                  version={v}
                  isCurrent={v.id === detail.currentVersionId}
                  justAdded={v.id === justAddedId}
                  onOpen={onOpen}
                  onDownload={onDownload}
                  onRestore={onRestore}
                  onDelete={onDelete}
                  onEditDescription={onEditDescription}
                />
              ))}
          </div>

          {isDragActive && (
            <div
              className={`animate-fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-apple-lg border-2 border-dashed bg-surface-modal/95 backdrop-blur-sm transition-all duration-200 ${
                hoveringZone ? "border-accent bg-accent/[0.09]" : "border-accent/40 bg-accent/[0.04]"
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-full bg-accent/15 transition-all duration-200 ${
                  hoveringZone ? "h-14 w-14 scale-105" : "h-12 w-12"
                }`}
              >
                <FileUp size={hoveringZone ? 24 : 20} className="text-accent" strokeWidth={1.75} />
              </div>
              <p className="text-[13.5px] font-semibold text-accent">{t("history.dropZoneTitle")}</p>
              <p className="text-[12px] text-label-secondary">{t("history.dropZoneSubtitle")}</p>
            </div>
          )}
        </div>

        <div className="border-t border-surface-border px-5 py-3.5">
          <Button variant="primary" onClick={onUploadNewVersion} className="w-full">
            <FileUp size={14} />
            {t("history.uploadNewVersion")}
          </Button>
        </div>
      </div>
    </div>
  );
}
