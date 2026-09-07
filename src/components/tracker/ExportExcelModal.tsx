import { FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { useProjects } from "@/hooks/useProjects";
import { useTrackerBoards } from "@/hooks/useTracker";
import { ApiError, countTrackerExport, exportTrackerTasksExcel, getTrackerStatuses } from "@/services/api";
import type { TrackerExportFilter, TrackerStatus } from "@/types";

interface ExportExcelModalProps {
  open: boolean;
  onCancel: () => void;
  onExported: () => void;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
}

/** Strips characters that are invalid in a filename on Windows/macOS/Linux. */
function sanitizeFilenamePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export function ExportExcelModal({ open, onCancel, onExported }: ExportExcelModalProps) {
  const { t } = useLanguage();
  const { projects } = useProjects();
  const { boards } = useTrackerBoards();

  const [projectId, setProjectId] = useState("");
  const [statusOptions, setStatusOptions] = useState<(TrackerStatus & { boardName: string })[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState(todayDate());
  const [dateTo, setDateTo] = useState(todayDate());
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProjectId("");
    setSelectedStatusIds(new Set());
    setDateFrom(todayDate());
    setDateTo(todayDate());
    setCount(null);
    setError(null);
    setBusy(false);
  }, [open]);

  // Every status across every board, board name attached for disambiguation
  // (two boards can each have their own "Done") - the export isn't scoped
  // to one board the way the Kanban view is.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const all = await Promise.all(
        boards.map(async (b) => (await getTrackerStatuses(b.id)).map((s) => ({ ...s, boardName: b.name }))),
      );
      if (!cancelled) setStatusOptions(all.flat());
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boards]);

  const dateRangeValid = dateFrom !== "" && dateTo !== "" && dateFrom <= dateTo;

  const filter: TrackerExportFilter = useMemo(
    () => ({
      projectId: projectId || undefined,
      statusIds: [...selectedStatusIds],
      dateFrom,
      dateTo,
    }),
    [projectId, selectedStatusIds, dateFrom, dateTo],
  );
  const filterKey = JSON.stringify(filter);

  // Debounced live preview count - re-fetched on every parameter change so
  // the modal always shows how many tasks the *current* selection matches.
  useEffect(() => {
    if (!open || !dateRangeValid) {
      setCount(null);
      setCounting(false);
      return;
    }
    let cancelled = false;
    setCounting(true);
    const timer = setTimeout(() => {
      countTrackerExport(filter)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          if (!cancelled) setCount(null);
        })
        .finally(() => {
          if (!cancelled) setCounting(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateRangeValid, filterKey]);

  function toggleStatus(id: string) {
    setSelectedStatusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (!dateRangeValid || !count) return;
    setBusy(true);
    setError(null);
    try {
      const projectName = projectId ? projects.find((p) => p.id === projectId)?.name ?? "" : t("tracker.export.allProjects");
      const namePart = sanitizeFilenamePart(projectName) || t("tracker.export.allProjects");
      const filename = `${t("tracker.export.filePrefix")}_${namePart}_${formatDdMmYyyy(dateFrom)}-${formatDdMmYyyy(dateTo)}.xlsx`;
      const saved = await exportTrackerTasksExcel(filter, filename);
      if (saved) onExported();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.actionErrorFallback"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]";
  const labelClass = "text-[11px] font-medium uppercase tracking-wide text-label-tertiary";
  const exportDisabled = busy || !dateRangeValid || count === null || count === 0;

  const selectedProjectLabel = projectId
    ? projects.find((p) => p.id === projectId)?.name ?? ""
    : t("tracker.export.allProjects");
  const selectedStatusLabel =
    selectedStatusIds.size === 0
      ? t("tracker.export.allStatuses")
      : selectedStatusIds.size === 1
        ? statusOptions.find((s) => selectedStatusIds.has(s.id))?.name ?? t("tracker.export.statusesSelected", { count: 1 })
        : t("tracker.export.statusesSelected", { count: selectedStatusIds.size });

  return (
    <Modal open={open} onClose={onCancel} width={440}>
      <ModalHeader title={t("tracker.export.title")} />
      <ModalBody>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t("tracker.export.project")}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={busy} className={inputClass}>
              <option value="">{t("tracker.export.allProjects")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("tracker.export.statuses")}</label>
            <div className="mt-1 max-h-40 overflow-y-auto rounded-apple-sm border border-surface-border bg-black/[0.02] p-1.5 dark:bg-white/[0.03]">
              <label className="flex items-center gap-2 rounded-apple-sm px-1.5 py-1 text-[12.5px] text-label-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  checked={selectedStatusIds.size === 0}
                  onChange={() => setSelectedStatusIds(new Set())}
                  disabled={busy}
                  className="accent-accent"
                />
                {t("tracker.export.allStatuses")}
              </label>
              {statusOptions.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-apple-sm px-1.5 py-1 text-[12.5px] text-label-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatusIds.has(s.id)}
                    onChange={() => toggleStatus(s.id)}
                    disabled={busy}
                    className="accent-accent"
                  />
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 truncate">
                    {s.boardName}: {s.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("tracker.export.period")}</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
              <span className="shrink-0 text-label-tertiary">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            {!dateRangeValid && dateFrom && dateTo && (
              <p className="mt-1 text-[11.5px] text-danger">{t("tracker.export.invalidRange")}</p>
            )}
          </div>

          <div className="rounded-apple-sm border border-surface-border bg-black/[0.02] px-3 py-2.5 text-[12.5px] dark:bg-white/[0.03]">
            <p className="mb-1.5 font-medium text-label-primary">{t("tracker.export.willExport")}</p>
            <ul className="space-y-0.5 text-label-secondary">
              <li>{t("tracker.export.summaryProject", { value: selectedProjectLabel })}</li>
              <li>{t("tracker.export.summaryStatuses", { value: selectedStatusLabel })}</li>
              <li>
                {t("tracker.export.summaryPeriod", {
                  value: dateRangeValid ? `${formatDdMmYyyy(dateFrom)} — ${formatDdMmYyyy(dateTo)}` : "—",
                })}
              </li>
            </ul>
            {dateRangeValid && (
              <p className="mt-1.5 border-t border-surface-border pt-1.5">
                {counting || count === null ? (
                  <span className="text-label-tertiary">{t("tracker.export.counting")}</span>
                ) : count === 0 ? (
                  <span className="text-label-secondary">{t("tracker.export.noData")}</span>
                ) : (
                  <span className="font-medium text-label-primary">{t("tracker.export.foundCount", { count })}</span>
                )}
              </p>
            )}
          </div>

          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleExport} disabled={exportDisabled}>
          <FileSpreadsheet size={13} />
          {t("tracker.export.confirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
