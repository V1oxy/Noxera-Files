import { FileTypeIcon } from "@/components/FileTypeIcon";
import { useLanguage } from "@/hooks/useLanguage";
import type { GlobalFileHit } from "@/types";
import { formatBytes, formatModified } from "@/utils/format";

interface GlobalSearchResultRowProps {
  hit: GlobalFileHit;
  onOpen: (hit: GlobalFileHit) => void;
}

export function GlobalSearchResultRow({ hit, onOpen }: GlobalSearchResultRowProps) {
  const { t, locale } = useLanguage();

  return (
    <div
      onClick={() => onOpen(hit)}
      className="group flex cursor-default items-center gap-3 rounded-apple-sm px-3 py-2.5 transition-colors hover:bg-surface-card-hover"
    >
      <FileTypeIcon filename={hit.currentVersion?.originalFilename ?? hit.name} size={22} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-label-primary">{hit.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-label-secondary">
          {t("search.projectLabel", { project: hit.projectName })}
          {hit.currentVersion && (
            <>
              {" · "}
              {formatModified(hit.currentVersion.createdAt, locale, t("common.today"), t("common.yesterday"))}
              {" · "}
              {formatBytes(hit.currentVersion.fileSize)}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
