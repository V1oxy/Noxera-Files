import { Check, Download, ExternalLink, ListPlus, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { useLanguage } from "@/hooks/useLanguage";
import { ApiError } from "@/services/api";
import type { FileVersion } from "@/types";
import { formatBytes, formatFullDateTime } from "@/utils/format";

interface VersionCardProps {
  version: FileVersion;
  isCurrent: boolean;
  /** True for a few seconds right after this version was created, for a brief confirmation glow. */
  justAdded?: boolean;
  onOpen: (version: FileVersion) => void;
  onDownload: (version: FileVersion) => void;
  onRestore: (version: FileVersion) => void;
  onDelete: (version: FileVersion) => void;
  onEditDescription: (version: FileVersion, description: string) => Promise<void>;
  onCreateTask: (version: FileVersion) => void;
}

export function VersionCard({
  version,
  isCurrent,
  justAdded,
  onOpen,
  onDownload,
  onRestore,
  onDelete,
  onEditDescription,
  onCreateTask,
}: VersionCardProps) {
  const { t, locale, translateError } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(version.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(version.description ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
    setDraft(version.description ?? "");
  }

  async function saveEditing() {
    setSaving(true);
    setError(null);
    try {
      await onEditDescription(version, draft.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("common.actionErrorFallback"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-apple border p-3 transition-shadow duration-500 ${
        isCurrent ? "border-accent/40 bg-accent/[0.06]" : "border-surface-border bg-surface-card"
      } ${justAdded ? "ring-2 ring-accent/60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-label-primary">v{version.versionNumber}</span>
          {isCurrent && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
              {t("version.current")}
            </span>
          )}
        </div>
        <span className="text-[11.5px] text-label-tertiary">{formatBytes(version.fileSize)}</span>
      </div>

      <p className="mt-1 text-[11.5px] text-label-secondary">{formatFullDateTime(version.createdAt, locale)}</p>

      {editing ? (
        <div className="mt-1.5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder={t("version.descriptionInputPlaceholder")}
            className="max-h-40 min-h-[4.5rem] w-full resize-y overflow-y-auto rounded-apple-sm bg-black/[0.03] p-2 text-[12.5px] leading-relaxed text-label-primary placeholder:text-label-tertiary outline-none focus-visible:outline-none focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
            style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
          />
          {error && <p className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={cancelEditing} disabled={saving}>
              <X size={13} />
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="primary" onClick={saveEditing} disabled={saving}>
              <Check size={13} />
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5">
          <ExpandableDescription
            text={version.description}
            className="min-w-0 flex-1"
            textClassName="text-[12.5px] leading-relaxed text-label-primary"
            collapsedLines={3}
            expandedMaxHeight={160}
            emptyPlaceholder={t("version.descriptionPlaceholder")}
          />
          <button
            type="button"
            title={t("version.editDescription")}
            onClick={startEditing}
            className="no-drag shrink-0 rounded-apple-sm p-1 text-label-tertiary transition-colors hover:bg-black/[0.06] hover:text-label-primary dark:hover:bg-white/[0.1]"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => onOpen(version)}>
          <ExternalLink size={13} />
          {t("menu.open")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onDownload(version)}>
          <Download size={13} />
          {t("common.download")}
        </Button>
        {!isCurrent && (
          <Button size="sm" variant="secondary" onClick={() => onRestore(version)}>
            <RotateCcw size={13} />
            {t("common.restore")}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => onDelete(version)}>
          <Trash2 size={13} />
          {t("common.delete")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCreateTask(version)}>
          <ListPlus size={13} />
          {t("tracker.createTaskFromVersion")}
        </Button>
      </div>
    </div>
  );
}
