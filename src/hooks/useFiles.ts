import { useCallback, useEffect, useRef, useState } from "react";

import { getFiles } from "@/services/api";
import type { FileEntry, SortDirection, SortField } from "@/types";

export function useFiles(
  projectId: string | null,
  folderId: string | null,
  search: string,
  sortField: SortField,
  sortDir: SortDirection,
) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!projectId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFiles(projectId, { folderId, search, sortField, sortDir });
      if (id === requestId.current) setFiles(result);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Unable to load files.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, folderId, search, sortField, sortDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { files, loading, error, refresh };
}
