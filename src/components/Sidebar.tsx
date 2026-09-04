import { FolderClosed, Layers, Plus, Settings as SettingsIcon } from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import type { Project } from "@/types";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  settingsActive: boolean;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onOpenSettings,
  settingsActive,
}: SidebarProps) {
  const { t } = useLanguage();

  return (
    <aside className="drag-region flex h-full w-60 shrink-0 flex-col border-r border-surface-border bg-surface-sidebar backdrop-blur-apple">
      <div className="h-10 shrink-0" />

      <div className="no-drag flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
          {t("sidebar.projects")}
        </p>

        <nav className="flex flex-col gap-0.5">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`group flex items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
                selectedProjectId === project.id && !settingsActive
                  ? "bg-accent/[0.14] text-accent font-medium"
                  : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              <FolderClosed
                size={15}
                strokeWidth={1.75}
                className={selectedProjectId === project.id && !settingsActive ? "text-accent" : "text-label-secondary"}
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
            </button>
          ))}

          {projects.length === 0 && (
            <p className="px-2 py-1.5 text-[12px] text-label-tertiary">{t("sidebar.noProjects")}</p>
          )}
        </nav>

        <button
          onClick={onNewProject}
          className="mt-2 flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] text-label-secondary transition-colors hover:bg-black/[0.04] hover:text-label-primary dark:hover:bg-white/[0.06]"
        >
          <Plus size={15} strokeWidth={1.75} />
          {t("sidebar.newProject")}
        </button>
      </div>

      <div className="no-drag border-t border-surface-border px-3 py-3">
        <button
          onClick={onOpenSettings}
          className={`flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
            settingsActive
              ? "bg-accent/[0.14] text-accent font-medium"
              : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          <SettingsIcon size={15} strokeWidth={1.75} className={settingsActive ? "text-accent" : "text-label-secondary"} />
          {t("sidebar.settings")}
        </button>
      </div>
    </aside>
  );
}

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-label-primary">
      <Layers size={16} className="text-accent" />
      Project Manager
    </div>
  );
}
