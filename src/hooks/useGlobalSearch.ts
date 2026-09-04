import { useEffect, useState } from "react";

import { searchFilesGlobal } from "@/services/api";
import type { GlobalFileHit } from "@/types";

/**
 * Cross-project search only runs while it's actually the active scope and
 * the query is non-empty - never fires on every keystroke of a normal
 * in-project search, and never fetches the full file list up front.
 */
export function useGlobalSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<GlobalFileHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || query.trim() === "") {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchFilesGlobal(query)
        .then((hits) => {
          if (!cancelled) setResults(hits);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, enabled]);

  return { results, loading };
}
