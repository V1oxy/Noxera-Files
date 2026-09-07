import { useCallback, useEffect, useRef, useState } from "react";

import { getFile } from "@/services/api";
import type { FileDetail } from "@/types";

export function useVersions(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!fileId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFile(fileId);
      if (id === requestId.current) setDetail(result);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Unable to load version history.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { detail, loading, error, refresh };
}
