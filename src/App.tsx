import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ProjectModal } from "@/components/ProjectModal";
import { Sidebar } from "@/components/Sidebar";
import { ToastContainer } from "@/components/Toast";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { useProjects } from "@/hooks/useProjects";
import { ToastProvider } from "@/hooks/useToast";
import { Onboarding } from "@/pages/Onboarding";
import { ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";
import { createProject, getSettings, isInitialized } from "@/services/api";

function MainShell() {
  const { setTheme } = useTheme();
  const { setLanguage, t } = useLanguage();
  const { projects, refresh: refreshProjects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [view, setView] = useState<"project" | "settings">("project");
  const [createOpen, setCreateOpen] = useState(false);
  const [navResetNonce, setNavResetNonce] = useState(0);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setTheme(s.theme, false);
        setLanguage(s.language, false);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-content">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setView("project");
          setNavResetNonce((n) => n + 1);
        }}
        onNewProject={() => setCreateOpen(true)}
        onOpenSettings={() => setView("settings")}
        settingsActive={view === "settings"}
      />

      {view === "settings" ? (
        <Settings />
      ) : selectedProject ? (
        <ProjectView
          key={selectedProject.id}
          project={selectedProject}
          navResetSignal={navResetNonce}
          onProjectUpdated={() => refreshProjects()}
          onProjectDeleted={async () => {
            setSelectedProjectId(null);
            await refreshProjects();
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={FolderPlus}
            title={t("projects.emptyTitle")}
            description={t("projects.emptyDescription")}
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                {t("sidebar.newProject")}
              </Button>
            }
          />
        </div>
      )}

      <ProjectModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onConfirm={async (name, description) => {
          const project = await createProject(name, description);
          setCreateOpen(false);
          await refreshProjects();
          setSelectedProjectId(project.id);
          setView("project");
        }}
      />

      <ToastContainer />
    </div>
  );
}

function AppInner() {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    isInitialized()
      .then(setReady)
      .catch(() => setReady(false));
  }, []);

  if (ready === null) {
    return <div className="h-screen w-screen bg-surface-bg" />;
  }

  if (!ready) {
    return <Onboarding onComplete={() => setReady(true)} />;
  }

  return <MainShell />;
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
