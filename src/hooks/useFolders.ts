import { useCallback, useEffect, useRef, useState } from "react";

import { getFolders } from "@/services/api";
import type { Folder } from "@/types";

export function useFolders(projectId: string | null, parentFolderId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!projectId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getFolders(projectId, parentFolderId);
      if (id === requestId.current) setFolders(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, parentFolderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { folders, loading, refresh };
}
