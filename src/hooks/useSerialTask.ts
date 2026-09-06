import { useCallback, useRef } from "react";

/**
 * Returns a function that runs async tasks strictly in the order they were
 * queued, never overlapping two in flight at once. Use this for
 * fire-and-forget persistence calls - drag-and-drop reorder above all -
 * where a user repeating the gesture quickly could otherwise let two
 * `reorder_*`/`move_*` backend calls race each other: whichever happens to
 * finish last "wins" and can silently overwrite a later, correct order with
 * a stale one. Queuing instead of firing both at once guarantees the calls
 * land in the same order the user made them.
 *
 * A failed task is swallowed here (the caller's own promise/catch already
 * ran) purely so it doesn't permanently wedge the queue for later calls.
 */
export function useSerialTask(): (task: () => Promise<unknown>) => void {
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback((task: () => Promise<unknown>) => {
    chainRef.current = chainRef.current.catch(() => {}).then(task);
  }, []);
}
