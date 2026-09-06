import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAllTrackerTasks,
  getFileTrackerTasks,
  getProjectTrackerTasks,
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBoards(await getTrackerBoards());
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    if (!boardId) {
      setStatuses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setStatuses(await getTrackerStatuses(boardId));
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    if (!boardId) {
      setFields([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFields(await getTrackerFields(boardId));
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    if (!boardId) {
      setLabels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLabels(await getTrackerLabels(boardId));
    } finally {
      setLoading(false);
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

  const refresh = useCallback(async () => {
    if (!boardId) {
      setPriorities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setPriorities(await getTrackerPriorities(boardId));
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { priorities, loading, refresh };
}

export function useTrackerTasks(boardId: string | null, includeArchived = false) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!boardId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTasks(await getTrackerTasks(boardId, includeArchived));
    } finally {
      setLoading(false);
    }
  }, [boardId, includeArchived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh, setTasks };
}

export function useProjectTrackerTasks(projectId: string | null) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTasks(await getProjectTrackerTasks(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh };
}

export function useFileTrackerTasks(fileId: string | null) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);

  const refresh = useCallback(async () => {
    if (!fileId) {
      setTasks([]);
      return;
    }
    setTasks(await getFileTrackerTasks(fileId));
  }, [fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, refresh };
}

export function useAllTrackerTasks(filter: TrackerTaskFilter) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getAllTrackerTasks(filter));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, loading, refresh };
}

export function useTrackerTaskDetail(taskId: string | null) {
  const [detail, setDetail] = useState<TrackerTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await getTrackerTask(taskId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this task.");
    } finally {
      setLoading(false);
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
