import { useCallback, useEffect, useState } from "react";

import { getFiles } from "@/services/api";
import type { FileEntry, SortDirection, SortField } from "@/types";

export function useFiles(
  projectId: string | null,
  search: string,
  sortField: SortField,
  sortDir: SortDirection,
) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFiles(await getFiles(projectId, { search, sortField, sortDir }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load files.");
    } finally {
      setLoading(false);
    }
  }, [projectId, search, sortField, sortDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { files, loading, error, refresh };
}
