import { useCallback, useEffect, useRef, useState } from "react";

import { getAllLinkGroups, getLinkGroups, getLinkProjects, getLinks } from "@/services/api";
import type { Link, LinkFilter, LinkGroup, LinkProject } from "@/types";

export function useLinkProjects() {
  const [projects, setProjects] = useState<LinkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getLinkProjects();
      if (id === requestId.current) setProjects(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, refresh };
}

export function useLinks(filter: LinkFilter) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filter);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getLinks(filter);
      if (id === requestId.current) setLinks(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { links, loading, refresh, setLinks };
}

export function useLinkGroups(projectId: string | null) {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!projectId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getLinkGroups(projectId);
      if (id === requestId.current) setGroups(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, loading, refresh };
}

/** Every group across every project - used by the "All" links view to
 * resolve group names/order without one request per project. */
export function useAllLinkGroups() {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getAllLinkGroups();
      if (id === requestId.current) setGroups(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, loading, refresh };
}
