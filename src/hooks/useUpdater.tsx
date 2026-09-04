import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type UpdateStatus = "idle" | "checking" | "upToDate" | "available" | "downloading" | "readyToRestart" | "error";

interface UpdaterContextValue {
  status: UpdateStatus;
  update: Update | null;
  progress: number;
  errorMessage: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restart: () => void;
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null);

/**
 * One shared updater state for the whole app: mounted once so the silent
 * startup check and the Settings page "Check for Updates" button both read
 * and act on the same in-flight state, instead of each holding its own
 * copy that could disagree about whether an update is ready.
 */
export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checking = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    setStatus("checking");
    setErrorMessage(null);
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setStatus("available");
      } else {
        setUpdate(null);
        setStatus("upToDate");
      }
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      checking.current = false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;
    setStatus("downloading");
    setProgress(0);
    setErrorMessage(null);
    let total = 0;
    let downloaded = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0);
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });
      setStatus("readyToRestart");
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [update]);

  const restart = useCallback(() => {
    void relaunch();
  }, []);

  // One quiet check shortly after launch - failures (offline, no network
  // permission yet, etc.) are expected often enough that they shouldn't
  // surface as an error state the user has to dismiss; only an explicit
  // "Check for Updates" click reports failure.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkForUpdate().catch(() => {});
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UpdaterContext.Provider
      value={{ status, update, progress, errorMessage, checkForUpdate, downloadAndInstall, restart }}
    >
      {children}
    </UpdaterContext.Provider>
  );
}

export function useUpdater() {
  const ctx = useContext(UpdaterContext);
  if (!ctx) throw new Error("useUpdater must be used within an UpdaterProvider");
  return ctx;
}
