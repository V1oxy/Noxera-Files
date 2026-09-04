import { Archive, FolderOpen, Globe, HardDrive, Laptop, Moon, ScrollText, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/Button";
import { useLanguage } from "@/hooks/useLanguage";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { ApiError, createBackup, openDataFolder, updateSettings } from "@/services/api";
import type { LanguageMode, ThemeMode } from "@/types";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
        {title}
      </h2>
      <div className="overflow-hidden rounded-apple border border-surface-border bg-surface-card shadow-card">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] text-label-primary">{label}</p>
        {description && <p className="mt-0.5 text-[11.5px] text-label-secondary">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

export function Settings() {
  const { settings, storageInfo, refresh } = useSettings();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t, translateError } = useLanguage();
  const { showToast } = useToast();
  const [backing, setBacking] = useState(false);

  const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "system", label: t("settings.theme.system"), icon: Laptop },
    { value: "light", label: t("settings.theme.light"), icon: Sun },
    { value: "dark", label: t("settings.theme.dark"), icon: Moon },
  ];

  const LANGUAGE_OPTIONS: { value: LanguageMode; label: string }[] = [
    { value: "system", label: t("settings.language.system") },
    { value: "en", label: t("settings.language.en") },
    { value: "ru", label: t("settings.language.ru") },
  ];

  async function handleThemeChange(mode: ThemeMode) {
    setTheme(mode);
  }

  async function handleLanguageChange(mode: LanguageMode) {
    setLanguage(mode);
  }

  async function handleToggleStartup() {
    if (!settings) return;
    try {
      await updateSettings({ launchAtStartup: !settings.launchAtStartup });
      await refresh();
    } catch (e) {
      showToast({
        title: t("toast.settingUpdateError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  async function handleCreateBackup() {
    setBacking(true);
    try {
      const result = await createBackup();
      showToast({ title: t("toast.backupCreated"), description: result.sizeHuman });
    } catch (e) {
      showToast({
        title: t("toast.backupError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    } finally {
      setBacking(false);
    }
  }

  return (
    <div className="h-full flex-1 overflow-y-auto px-8 pb-10 pt-10">
      <div className="drag-region mb-6">
        <h1 className="text-[20px] font-semibold text-label-primary">{t("settings.title")}</h1>
      </div>

      <div className="no-drag mx-auto max-w-lg">
        <SettingsSection title={t("settings.storage")}>
          <SettingsRow label={t("settings.storageLocation")} description={storageInfo?.path ?? settings?.storagePath}>
            <Button size="sm" variant="secondary" onClick={() => openDataFolder("storage")}>
              <FolderOpen size={13} />
              {t("settings.openFolder")}
            </Button>
          </SettingsRow>
          <SettingsRow label={t("settings.dataUsed")} description={storageInfo?.totalSizeHuman ?? t("settings.calculating")}>
            <HardDrive size={15} className="text-label-tertiary" />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t("settings.backup")}>
          <SettingsRow label={t("settings.createBackup")} description={t("settings.createBackupDescription")}>
            <Button size="sm" variant="secondary" onClick={handleCreateBackup} disabled={backing}>
              <Archive size={13} />
              {backing ? t("settings.creating") : t("settings.createBackupButton")}
            </Button>
          </SettingsRow>
          <SettingsRow label={t("settings.backupsFolder")}>
            <Button size="sm" variant="secondary" onClick={() => openDataFolder("backups")}>
              <FolderOpen size={13} />
              {t("settings.openFolder")}
            </Button>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t("settings.appearance")}>
          <div className="flex gap-2 p-3">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-apple-sm border px-3 py-2.5 text-[12px] transition-colors ${
                  theme === opt.value
                    ? "border-accent bg-accent/[0.08] text-accent"
                    : "border-surface-border text-label-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                }`}
              >
                <opt.icon size={16} strokeWidth={1.5} />
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={t("settings.language")}>
          <div className="flex gap-2 p-3">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleLanguageChange(opt.value)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-apple-sm border px-3 py-2.5 text-[12px] transition-colors ${
                  language === opt.value
                    ? "border-accent bg-accent/[0.08] text-accent"
                    : "border-surface-border text-label-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                }`}
              >
                <Globe size={16} strokeWidth={1.5} />
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={t("settings.general")}>
          <SettingsRow label={t("settings.launchAtStartup")}>
            <button
              onClick={handleToggleStartup}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                settings?.launchAtStartup ? "bg-accent" : "bg-black/15 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  settings?.launchAtStartup ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </SettingsRow>
          <SettingsRow label={t("settings.logs")}>
            <Button size="sm" variant="secondary" onClick={() => openDataFolder("logs")}>
              <ScrollText size={13} />
              {t("settings.openLogsFolder")}
            </Button>
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
}
