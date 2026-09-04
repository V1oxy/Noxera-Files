import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { updateSettings } from "@/services/api";
import { backendErrorTranslations, translations, type Lang } from "@/i18n/translations";
import type { LanguageMode } from "@/types";

interface LanguageContextValue {
  language: LanguageMode;
  resolvedLang: Lang;
  locale: string;
  setLanguage: (language: LanguageMode, persist?: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  translateError: (message: string) => string;
}

const LOCALE_BY_LANG: Record<Lang, string> = { en: "en-US", ru: "ru-RU" };

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveSystemLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() : "en";
  return nav?.startsWith("ru") ? "ru" : "en";
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageMode>("system");
  const resolvedLang: Lang = language === "system" ? resolveSystemLang() : language;

  function setLanguage(next: LanguageMode, persist = true) {
    setLanguageState(next);
    if (persist) {
      updateSettings({ language: next }).catch(() => {});
    }
  }

  function t(key: string, vars?: Record<string, string | number>): string {
    const count = vars?.count;
    const pluralKey = typeof count === "number" && count !== 1 ? `${key}_plural` : null;
    const dict = translations[resolvedLang];
    const template =
      (pluralKey && dict[pluralKey]) ??
      dict[key] ??
      (pluralKey && translations.en[pluralKey]) ??
      translations.en[key] ??
      key;
    return interpolate(template, vars);
  }

  function translateError(message: string): string {
    if (resolvedLang !== "ru") return message;
    return backendErrorTranslations[message] ?? message;
  }

  return (
    <LanguageContext.Provider
      value={{ language, resolvedLang, locale: LOCALE_BY_LANG[resolvedLang], setLanguage, t, translateError }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
