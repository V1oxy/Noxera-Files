import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

const appWindow = getCurrentWindow();

/**
 * Fully custom, chrome-less title bar: the OS window decorations (native
 * title text + app icon) are disabled in tauri.conf.json, so this is the
 * only source of window dragging and minimize/maximize/close controls.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void appWindow.isMaximized().then((v) => {
      if (!cancelled) setMaximized(v);
    });

    const unlisten = appWindow.onResized(() => {
      void appWindow.isMaximized().then((v) => {
        if (!cancelled) setMaximized(v);
      });
    });

    return () => {
      cancelled = true;
      void unlisten.then((f) => f());
    };
  }, []);

  return (
    <div
      className="drag-region flex h-8 shrink-0 items-center justify-end bg-surface-sidebar"
      onDoubleClick={() => void appWindow.toggleMaximize()}
    >
      <button
        type="button"
        title="Minimize"
        aria-label="Minimize"
        onClick={() => void appWindow.minimize()}
        className="no-drag flex h-8 w-11 items-center justify-center text-label-secondary transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        title={maximized ? "Restore" : "Maximize"}
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => void appWindow.toggleMaximize()}
        className="no-drag flex h-8 w-11 items-center justify-center text-label-secondary transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </button>
      <button
        type="button"
        title="Close"
        aria-label="Close"
        onClick={() => void appWindow.close()}
        className="no-drag flex h-8 w-11 items-center justify-center text-label-secondary transition-colors hover:bg-danger hover:text-white"
      >
        <X size={15} />
      </button>
    </div>
  );
}
