import { useCallback, useEffect, useState } from "react";

import { getSettings, getStorageInfo } from "@/services/api";
import type { AppSettings, StorageInfo } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, info] = await Promise.all([getSettings(), getStorageInfo()]);
      setSettings(s);
      setStorageInfo(info);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, storageInfo, loading, refresh };
}
