import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LINKS_ALL_TAB } from "@/constants/links";
import { ProjectModal } from "@/components/ProjectModal";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { ToastContainer } from "@/components/Toast";
import { NewBoardModal } from "@/components/tracker/NewBoardModal";
import type { NewTaskInitialFile } from "@/components/tracker/NewTaskModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { AccentColorProvider, useAccentColor } from "@/hooks/useAccentColor";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { useProjects } from "@/hooks/useProjects";
import { ToastProvider } from "@/hooks/useToast";
import { useLinkProjects } from "@/hooks/useLinks";
import { useSerialTask } from "@/hooks/useSerialTask";
import { useTrackerBoards, useTrackerUiState } from "@/hooks/useTracker";
import { UpdaterProvider, useUpdater } from "@/hooks/useUpdater";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { LinksView } from "@/pages/LinksView";
import { Onboarding } from "@/pages/Onboarding";
import { type PendingFileOpen, ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";
import { TrackerView } from "@/pages/TrackerView";
import { createProject, createTrackerBoard, getSettings, isInitialized, reorderProjects, reorderTrackerBoards, updateSettings } from "@/services/api";
import type { GlobalFileHit } from "@/types";

function MainShell() {
  const { setTheme } = useTheme();
  const { setLanguage, t } = useLanguage();
  const { setAccentColor } = useAccentColor();
  const { status: updateStatus } = useUpdater();
  const { data: whatsNewData, dismiss: dismissWhatsNew } = useWhatsNew();
  const { projects, refresh: refreshProjects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [view, setView] = useState<"project" | "settings" | "tracker" | "links">("project");
  const [createOpen, setCreateOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [navResetNonce, setNavResetNonce] = useState(0);
  const [pendingFileOpen, setPendingFileOpen] = useState<PendingFileOpen | null>(null);
  const { boards: trackerBoards, refresh: refreshTrackerBoards } = useTrackerBoards();
  const tracker = useTrackerUiState();
  const runProjectReorder = useSerialTask();
  const runBoardReorder = useSerialTask();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingNewTaskFile, setPendingNewTaskFile] = useState<NewTaskInitialFile | null>(null);
  // Defaults to visible so the section doesn't flash hidden while settings
  // are still loading - flipped to false only once we actually know the
  // user turned it off (see Settings' onTrackerEnabledChanged).
  const [trackerEnabled, setTrackerEnabled] = useState(true);
  const [linksEnabled, setLinksEnabled] = useState(true);
  const { projects: linkProjects, refresh: refreshLinkProjects } = useLinkProjects();
  // Lifted here (rather than owned by LinksView) so the sidebar's link
  // project list can highlight whichever tab is active and switch it,
  // regardless of whether it was last changed from the sidebar or the
  // in-page tab bar.
  const [linksTab, setLinksTab] = useState(LINKS_ALL_TAB);
  // Independent per-section collapse state for the sidebar's item trees
  // (Files/Tracker/Links) - defaults to all expanded while settings are
  // still loading, then synced to whatever was persisted (see the effect
  // below and Sidebar's onToggleSection).
  const [sidebarCollapsed, setSidebarCollapsed] = useState({ files: false, tracker: false, links: false });

  function openTask(taskId: string) {
    setPendingTaskId(taskId);
    setView("tracker");
  }

  function createTaskFromFile(file: NewTaskInitialFile) {
    setPendingNewTaskFile(file);
    setView("tracker");
  }

  useEffect(() => {
    getSettings()
      .then((s) => {
        setTheme(s.theme, false);
        setLanguage(s.language, false);
        setAccentColor(s.accentColor, false);
        setTrackerEnabled(s.trackerEnabled);
        setLinksEnabled(s.linksEnabled);
        setSidebarCollapsed({
          files: s.sidebarFilesCollapsed,
          tracker: s.sidebarTrackerCollapsed,
          links: s.sidebarLinksCollapsed,
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A UI convenience, not user data - update optimistically and persist in
  // the background without blocking or surfacing errors for it.
  function toggleSidebarSection(section: "files" | "tracker" | "links") {
    setSidebarCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      const key = (
        { files: "sidebarFilesCollapsed", tracker: "sidebarTrackerCollapsed", links: "sidebarLinksCollapsed" } as const
      )[section];
      void updateSettings({ [key]: next[section] }).catch(() => {});
      return next;
    });
  }

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Turning the module off while it's open sends the user back to their
  // projects instead of leaving them stranded on a screen that just
  // disappeared from the sidebar - the tracker's own data is untouched, so
  // there's nothing to clean up here, just the current screen.
  useEffect(() => {
    if (!trackerEnabled && view === "tracker") {
      setView("project");
    }
  }, [trackerEnabled, view]);

  // Same reasoning as the tracker redirect above - the links module's data
  // is untouched by hiding it, only the current screen needs to move.
  useEffect(() => {
    if (!linksEnabled && view === "links") {
      setView("project");
    }
  }, [linksEnabled, view]);

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

  function handleOpenProjectFromTracker(projectId: string) {
    setSelectedProjectId(projectId);
    setView("project");
    setNavResetNonce((n) => n + 1);
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
          runProjectReorder(() => reorderProjects(orderedIds).then(() => refreshProjects()));
        }}
        settingsActive={view === "settings"}
        updateAvailable={updateStatus === "available" || updateStatus === "readyToRestart"}
        trackerVisible={trackerEnabled}
        projectListActive={view === "project"}
        trackerActive={view === "tracker"}
        trackerBoards={trackerBoards}
        trackerView={tracker.state.view}
        onSelectTrackerBoard={(boardId) => {
          tracker.update({ view: { kind: "board", boardId } });
          setView("tracker");
        }}
        onSelectAllTasks={() => {
          tracker.update({ view: { kind: "all" } });
          setView("tracker");
        }}
        onNewTrackerBoard={() => setNewBoardOpen(true)}
        onReorderTrackerBoards={(orderedIds) => {
          runBoardReorder(() => reorderTrackerBoards(orderedIds).then(() => refreshTrackerBoards()));
        }}
        linksVisible={linksEnabled}
        linksActive={view === "links"}
        linkProjects={linkProjects}
        linksTab={linksTab}
        onSelectAllLinks={() => {
          setLinksTab(LINKS_ALL_TAB);
          setView("links");
        }}
        onSelectLinkProject={(projectId) => {
          setLinksTab(projectId);
          setView("links");
        }}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarSection={toggleSidebarSection}
      />

      <div className="relative isolate flex flex-1 flex-col overflow-hidden">
        {view === "settings" ? (
          <Settings onTrackerEnabledChanged={setTrackerEnabled} onLinksEnabledChanged={setLinksEnabled} />
        ) : view === "links" && linksEnabled ? (
          <LinksView
            projects={linkProjects}
            onProjectsChanged={() => refreshLinkProjects()}
            activeTab={linksTab}
            onActiveTabChange={setLinksTab}
          />
        ) : view === "tracker" && trackerEnabled ? (
          <TrackerView
            boards={trackerBoards}
            onBoardsChanged={() => refreshTrackerBoards()}
            uiState={tracker.state}
            updateUiState={tracker.update}
            pendingTaskId={pendingTaskId}
            onPendingTaskHandled={() => setPendingTaskId(null)}
            pendingNewTaskFile={pendingNewTaskFile}
            onPendingNewTaskFileHandled={() => setPendingNewTaskFile(null)}
            onOpenProject={handleOpenProjectFromTracker}
          />
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
            onOpenTask={openTask}
            onCreateTaskFromFile={createTaskFromFile}
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

      <NewBoardModal
        open={newBoardOpen}
        onCancel={() => setNewBoardOpen(false)}
        onConfirm={async (name) => {
          const board = await createTrackerBoard({ name });
          setNewBoardOpen(false);
          await refreshTrackerBoards();
          tracker.update({ view: { kind: "board", boardId: board.id } });
          setView("tracker");
        }}
      />

      <ToastContainer />

      <WhatsNewModal data={whatsNewData} onClose={dismissWhatsNew} />
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
            <UpdaterProvider>
              <AppInner />
            </UpdaterProvider>
          </ToastProvider>
        </LanguageProvider>
      </AccentColorProvider>
    </ThemeProvider>
  );
}
