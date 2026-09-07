import { useCallback, useEffect, useRef, useState } from "react";

import { getProjects } from "@/services/api";
import type { Project } from "@/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getProjects();
      if (id === requestId.current) setProjects(result);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Unable to load projects.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
