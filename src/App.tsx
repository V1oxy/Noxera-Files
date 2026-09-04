import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ProjectModal } from "@/components/ProjectModal";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { ToastContainer } from "@/components/Toast";
import { AccentColorProvider, useAccentColor } from "@/hooks/useAccentColor";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { useProjects } from "@/hooks/useProjects";
import { ToastProvider } from "@/hooks/useToast";
import { Onboarding } from "@/pages/Onboarding";
import { type PendingFileOpen, ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";
import { createProject, getSettings, isInitialized, reorderProjects } from "@/services/api";
import type { GlobalFileHit } from "@/types";

function MainShell() {
  const { setTheme } = useTheme();
  const { setLanguage, t } = useLanguage();
  const { setAccentColor } = useAccentColor();
  const { projects, refresh: refreshProjects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [view, setView] = useState<"project" | "settings">("project");
  const [createOpen, setCreateOpen] = useState(false);
  const [navResetNonce, setNavResetNonce] = useState(0);
  const [pendingFileOpen, setPendingFileOpen] = useState<PendingFileOpen | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setTheme(s.theme, false);
        setLanguage(s.language, false);
        setAccentColor(s.accentColor, false);
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

  function handleNavigateToFile(hit: GlobalFileHit) {
    if (hit.projectId !== selectedProjectId) {
      setSelectedProjectId(hit.projectId);
      setView("project");
    }
    // requestId makes this fire even for a repeat click on the same file
    // (ProjectView's effect keys off it, not fileId/folderId alone).
    setPendingFileOpen({ requestId: Date.now(), fileId: hit.id, folderId: hit.folderId });
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-surface-content">
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
        onReorderProjects={(orderedIds) => {
          void reorderProjects(orderedIds).then(() => refreshProjects());
        }}
        settingsActive={view === "settings"}
      />

      <div className="relative isolate flex flex-1 flex-col overflow-hidden">
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
            pendingFileOpen={pendingFileOpen}
            onPendingFileOpenHandled={() => setPendingFileOpen(null)}
            onNavigateToFile={handleNavigateToFile}
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
      </div>

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

  useEffect(() => {
    // This is a desktop app, not a web page - suppress the WebView's native
    // context menu (Reload / Save as / Print) everywhere except text fields,
    // where the OS's own Cut/Copy/Paste menu is still useful. Rows that
    // provide their own context menu (FileRow, FolderRow) already call
    // preventDefault() themselves, so this is a no-op for them.
    function handleContextMenu(e: MouseEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    }
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />
      {ready === null ? (
        <div className="flex-1 bg-surface-bg" />
      ) : !ready ? (
        <Onboarding onComplete={() => setReady(true)} />
      ) : (
        <MainShell />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AccentColorProvider>
        <LanguageProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </LanguageProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
