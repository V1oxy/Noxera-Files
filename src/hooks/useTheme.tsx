import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { updateSettings } from "@/services/api";
import type { ThemeMode } from "@/types";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode, persist?: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(resolveSystemTheme());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  function setTheme(next: ThemeMode, persist = true) {
    setThemeState(next);
    if (persist) {
      updateSettings({ theme: next }).catch(() => {});
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
