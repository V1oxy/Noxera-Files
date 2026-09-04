import { useCallback, useEffect, useState } from "react";

import { getFile } from "@/services/api";
import type { FileDetail } from "@/types";

export function useVersions(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fileId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await getFile(fileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load version history.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { detail, loading, error, refresh };
}
