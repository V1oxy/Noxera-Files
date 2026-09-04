import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  DEFAULT_ACCENT_COLOR,
  getAccentColorPreset,
  type AccentColorKey,
} from "@/constants/accentColors";
import { updateSettings } from "@/services/api";
import { useTheme } from "@/hooks/useTheme";

interface AccentColorContextValue {
  accentColor: AccentColorKey;
  setAccentColor: (color: AccentColorKey, persist?: boolean) => void;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState<AccentColorKey>(DEFAULT_ACCENT_COLOR);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const preset = getAccentColorPreset(accentColor);
    const shades = resolvedTheme === "dark" ? preset.dark : preset.light;
    const root = document.documentElement.style;
    root.setProperty("--accent-rgb", shades.rgb);
    root.setProperty("--accent-hover-rgb", shades.hoverRgb);
  }, [accentColor, resolvedTheme]);

  function setAccentColor(next: AccentColorKey, persist = true) {
    setAccentColorState(next);
    if (persist) {
      updateSettings({ accentColor: next }).catch(() => {});
    }
  }

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const ctx = useContext(AccentColorContext);
  if (!ctx) throw new Error("useAccentColor must be used within an AccentColorProvider");
  return ctx;
}
