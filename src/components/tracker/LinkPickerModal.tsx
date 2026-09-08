import { Link as LinkIcon, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal, ModalBody, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { getLinks } from "@/services/api";
import type { Link } from "@/types";

interface LinkPickerModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (link: Link) => void;
}

const PAGE_SIZE = 50;

/**
 * Picks an existing link from the Links section to attach to a task -
 * mirrors `FilePickerModal`'s search-first flow, but flat (Links has no
 * folder nesting to browse, just a search box over every link).
 */
export function LinkPickerModal({ open, onCancel, onConfirm }: LinkPickerModalProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getLinks({ search: search.trim() || undefined, limit: PAGE_SIZE })
        .then((hits) => {
          if (!cancelled) setResults(hits);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  return (
    <Modal open={open} onClose={onCancel} width={480}>
      <ModalHeader title={t("tracker.pickLinkTitle")} />
      <ModalBody>
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-tertiary" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("links.searchPlaceholder")}
            className="h-8 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] pl-7 pr-2.5 text-[13px] text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 dark:bg-white/[0.05]"
          />
        </div>

        <div className="mt-2 max-h-80 space-y-0.5 overflow-y-auto rounded-apple-sm border border-surface-border p-1.5">
          {loading && <p className="px-2 py-6 text-center text-[12.5px] text-label-tertiary">{t("files.loading")}</p>}
          {!loading && results.length === 0 && (
            <p className="px-2 py-6 text-center text-[12.5px] text-label-tertiary">{t("tracker.pickLinkEmpty")}</p>
          )}
          {!loading &&
            results.map((link) => (
              <button
                key={link.id}
                onClick={() => onConfirm(link)}
                className="flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                <LinkIcon size={15} className="shrink-0 text-label-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{link.title}</span>
                  <span className="block truncate text-[11px] text-label-tertiary">{link.url}</span>
                </span>
                <span className="shrink-0 text-[11px] text-label-tertiary">{link.projectName}</span>
              </button>
            ))}
        </div>
      </ModalBody>
    </Modal>
  );
}
