import { useCallback, useEffect, useState } from "react";

import { getFolders } from "@/services/api";
import type { Folder } from "@/types";

export function useFolders(projectId: string | null, parentFolderId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFolders(await getFolders(projectId, parentFolderId));
    } finally {
      setLoading(false);
    }
  }, [projectId, parentFolderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { folders, loading, refresh };
}
