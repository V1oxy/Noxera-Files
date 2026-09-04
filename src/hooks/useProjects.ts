import { useCallback, useEffect, useState } from "react";

import { getProjects } from "@/services/api";
import type { Project } from "@/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await getProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
