import { useCallback, useEffect, useRef, useState } from "react";

import { getFiles } from "@/services/api";
import type { FileEntry, SortDirection, SortField } from "@/types";

/** One page's worth of files per fetch, whether that's the initial load or
 * a scroll-triggered "load more" - keeps a folder/search view's cost flat
 * regardless of how many files it actually holds. */
const FILES_PAGE_SIZE = 150;

export function useFiles(
  projectId: string | null,
  folderId: string | null,
  search: string,
  sortField: SortField,
  sortDir: SortDirection,
) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!projectId) {
      setFiles([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await getFiles(projectId, { folderId, search, sortField, sortDir, limit: FILES_PAGE_SIZE, offset: 0 });
      if (id === requestId.current) {
        setFiles(page);
        setHasMore(page.length === FILES_PAGE_SIZE);
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Unable to load files.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, folderId, search, sortField, sortDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!projectId || loadingMore || !hasMore) return;
    const id = ++requestId.current;
    setLoadingMore(true);
    try {
      const page = await getFiles(projectId, { folderId, search, sortField, sortDir, limit: FILES_PAGE_SIZE, offset: files.length });
      if (id === requestId.current) {
        setFiles((prev) => [...prev, ...page]);
        setHasMore(page.length === FILES_PAGE_SIZE);
      }
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, folderId, search, sortField, sortDir, files.length, hasMore, loadingMore]);

  return { files, loading, loadingMore, hasMore, error, refresh, loadMore };
}
