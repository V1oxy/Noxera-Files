import { useCallback, useEffect, useState } from "react";

import { getAllLinkGroups, getLinkGroups, getLinkProjects, getLinks } from "@/services/api";
import type { Link, LinkFilter, LinkGroup, LinkProject } from "@/types";

export function useLinkProjects() {
  const [projects, setProjects] = useState<LinkProject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await getLinkProjects());
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await getLinks(filter));
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    if (!projectId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setGroups(await getLinkGroups(projectId));
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await getAllLinkGroups());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, loading, refresh };
}
