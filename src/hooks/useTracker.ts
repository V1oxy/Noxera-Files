import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAllTrackerTasks,
  getFileTrackerTasks,
  getTrackerBoardColumnPage,
  getTrackerBoards,
  getTrackerFields,
  getTrackerLabels,
  getTrackerPriorities,
  getTrackerStatuses,
  getTrackerTask,
  getTrackerTasks,
  getTrackerUiState,
  setTrackerUiState,
} from "@/services/api";
import type {
  SortDirection,
  TaskSortField,
  TrackerBoard,
  TrackerField,
  TrackerLabel,
  TrackerPriority,
  TrackerStatus,
  TrackerTask,
  TrackerTaskDetail,
  TrackerTaskFilter,
} from "@/types";

export function useTrackerBoards() {
  const [boards, setBoards] = useState<TrackerBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getTrackerBoards();
      if (id === requestId.current) setBoards(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { boards, loading, refresh };
}

export function useTrackerStatuses(boardId: string | null) {
  const [statuses, setStatuses] = useState<TrackerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!boardId) {
      setStatuses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrackerStatuses(boardId);
      if (id === requestId.current) setStatuses(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { statuses, loading, refresh };
}

export function useTrackerFields(boardId: string | null) {
  const [fields, setFields] = useState<TrackerField[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!boardId) {
      setFields([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrackerFields(boardId);
      if (id === requestId.current) setFields(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { fields, loading, refresh };
}

export function useTrackerLabels(boardId: string | null) {
  const [labels, setLabels] = useState<TrackerLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!boardId) {
      setLabels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrackerLabels(boardId);
      if (id === requestId.current) setLabels(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { labels, loading, refresh };
}

export function useTrackerPriorities(boardId: string | null) {
  const [priorities, setPriorities] = useState<TrackerPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!boardId) {
      setPriorities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrackerPriorities(boardId);
      if (id === requestId.current) setPriorities(result);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { priorities, loading, refresh };
}

/** Initial cap per status column, via `list_for_board`'s `ROW_NUMBER()`
 * window - keeps opening a board flat-cost regardless of how many tasks it
 * holds. A column past this size grows one page at a time as the user
 * scrolls it, via `loadMoreForStatus` below. */
const KANBAN_PER_STATUS_LIMIT = 100;

export function useTrackerTasks(boardId: string | null, includeArchived = false) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);
  // Keyed by statusId - a column is only known to have more once its
  // initial (or latest) page came back completely full.
  const [columnHasMore, setColumnHasMore] = useState<Record<string, boolean>>({});
  const [columnLoadingMore, setColumnLoadingMore] = useState<Record<string, boolean>>({});
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!boardId) {
      setTasks([]);
      setLoading(false);
      setColumnHasMore({});
      return;
    }
    setLoading(true);
    try {
      const result = await getTrackerTasks(boardId, includeArchived, KANBAN_PER_STATUS_LIMIT);
      if (id === requestId.current) {
        setTasks(result);
        const counts = new Map<string, number>();
        for (const task of result) counts.set(task.statusId, (counts.get(task.statusId) ?? 0) + 1);
        const nextHasMore: Record<string, boolean> = {};
        for (const [statusId, count] of counts) {
          nextHasMore[statusId] = count >= KANBAN_PER_STATUS_LIMIT;
        }
        setColumnHasMore(nextHasMore);
        setColumnLoadingMore({});
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [boardId, includeArchived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMoreForStatus = useCallback(
    async (statusId: string) => {
      if (!boardId || columnLoadingMore[statusId] || !columnHasMore[statusId]) return;
      setColumnLoadingMore((prev) => ({ ...prev, [statusId]: true }));
      try {
        const loadedCount = tasks.filter((t) => t.statusId === statusId).length;
        const page = await getTrackerBoardColumnPage(boardId, statusId, includeArchived, KANBAN_PER_STATUS_LIMIT, loadedCount);
        setTasks((prev) => [...prev, ...page]);
        setColumnHasMore((prev) => ({ ...prev, [statusId]: page.length >= KANBAN_PER_STATUS_LIMIT }));
      } finally {
        setColumnLoadingMore((prev) => ({ ...prev, [statusId]: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, includeArchived, tasks, columnHasMore, columnLoadingMore],
  );

  return { tasks, loading, columnHasMore, columnLoadingMore, refresh, loadMoreForStatus, setTasks };
}

export function useFileTrackerTasks(fileId: string | null) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!fileId) {
      setTasks([]);
      return;
    }
    const result = await getFileTrackerTasks(fileId);
    if (id === requestId.current) setTasks(result);
  }, [fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, refresh };
}

/** One page's worth of tasks per fetch, whether that's the initial load or
 * a scroll-triggered "load more" - keeps this view's cost flat regardless
 * of how many tasks exist in total (see `tracker_tasks::list_all`). */
const ALL_TASKS_PAGE_SIZE = 150;

export function useAllTrackerTasks(filter: TrackerTaskFilter) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const filterKey = JSON.stringify(filter);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await getAllTrackerTasks({ ...filter, limit: ALL_TASKS_PAGE_SIZE, offset: 0 });
      if (id === requestId.current) {
        setTasks(page);
        setHasMore(page.length === ALL_TASKS_PAGE_SIZE);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const id = ++requestId.current;
    setLoadingMore(true);
    try {
      const page = await getAllTrackerTasks({ ...filter, limit: ALL_TASKS_PAGE_SIZE, offset: tasks.length });
      if (id === requestId.current) {
        setTasks((prev) => [...prev, ...page]);
        setHasMore(page.length === ALL_TASKS_PAGE_SIZE);
      }
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, tasks.length, hasMore, loadingMore]);

  return { tasks, loading, loadingMore, hasMore, refresh, loadMore };
}

export function useTrackerTaskDetail(taskId: string | null) {
  const [detail, setDetail] = useState<TrackerTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!taskId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getTrackerTask(taskId);
      if (id === requestId.current) setDetail(result);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Unable to load this task.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { detail, loading, error, refresh };
}

// ---- Persisted UI state (spec section 35) --------------------------------------

export type TrackerViewState = { kind: "board"; boardId: string } | { kind: "all" };

export interface TrackerUiState {
  view: TrackerViewState | null;
  allTasksFilter: TrackerTaskFilter;
  allTasksSortField: TaskSortField;
  allTasksSortDir: SortDirection;
}

const DEFAULT_UI_STATE: TrackerUiState = {
  view: null,
  allTasksFilter: {},
  allTasksSortField: "created",
  allTasksSortDir: "desc",
};

/**
 * Loads the tracker's remembered view/filters/sort once on mount and
 * persists every change back (debounced) to the same opaque JSON blob the
 * backend stores under one settings key - see `commands/tracker_settings.rs`.
 */
export function useTrackerUiState() {
  const [state, setState] = useState<TrackerUiState>(DEFAULT_UI_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTrackerUiState()
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            setState({ ...DEFAULT_UI_STATE, ...JSON.parse(raw) });
          } catch {
            // Corrupted/old-shape blob - fall back to defaults rather than crash.
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<TrackerUiState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void setTrackerUiState(JSON.stringify(next));
      }, 400);
      return next;
    });
  }, []);

  return { state, loaded, update };
}
