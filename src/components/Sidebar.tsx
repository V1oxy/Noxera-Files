import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FolderClosed, Kanban, Layers, ListChecks, Plus, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SortableRow } from "@/components/SortableRow";
import { useLanguage } from "@/hooks/useLanguage";
import type { TrackerViewState } from "@/hooks/useTracker";
import type { Project, TrackerBoard } from "@/types";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onReorderProjects: (orderedIds: string[]) => void;
  settingsActive: boolean;
  updateAvailable?: boolean;
  trackerVisible: boolean;
  projectListActive: boolean;
  trackerActive: boolean;
  trackerBoards: TrackerBoard[];
  trackerView: TrackerViewState | null;
  onSelectTrackerBoard: (boardId: string) => void;
  onSelectAllTasks: () => void;
  onNewTrackerBoard: () => void;
  onReorderTrackerBoards: (orderedIds: string[]) => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onOpenSettings,
  onReorderProjects,
  settingsActive,
  updateAvailable,
  trackerVisible,
  projectListActive,
  trackerActive,
  trackerBoards,
  trackerView,
  onSelectTrackerBoard,
  onSelectAllTasks,
  onNewTrackerBoard,
  onReorderTrackerBoards,
}: SidebarProps) {
  const { t } = useLanguage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Mirrors `projects` locally so a drag can reorder instantly - the props
  // update a moment later once the new order round-trips through the store,
  // and would otherwise cause a visible snap-back while that's in flight.
  const [order, setOrder] = useState(projects);
  useEffect(() => {
    setOrder(projects);
  }, [projects]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((p) => p.id === active.id);
    const newIndex = order.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorderProjects(next.map((p) => p.id));
  }

  // Same pattern as the projects list above - a local mirror so dragging a
  // board reorders instantly instead of waiting for the round-trip.
  const [boardOrder, setBoardOrder] = useState(trackerBoards);
  useEffect(() => {
    setBoardOrder(trackerBoards);
  }, [trackerBoards]);

  function handleBoardDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = boardOrder.findIndex((b) => b.id === active.id);
    const newIndex = boardOrder.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(boardOrder, oldIndex, newIndex);
    setBoardOrder(next);
    onReorderTrackerBoards(next.map((b) => b.id));
  }

  return (
    <aside className="drag-region flex h-full w-60 shrink-0 flex-col border-r border-surface-border bg-surface-sidebar backdrop-blur-apple">
      <div className="h-10 shrink-0" />

      <div className="no-drag flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
          {t("sidebar.projects")}
        </p>

        <nav className="flex flex-col gap-0.5">
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {order.map((project) => (
                <SortableRow key={project.id} id={project.id}>
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className={`group flex w-full cursor-default items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
                      selectedProjectId === project.id && projectListActive
                        ? "bg-accent/[0.14] text-accent font-medium"
                        : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <FolderClosed
                      size={15}
                      strokeWidth={1.75}
                      className={selectedProjectId === project.id && projectListActive ? "text-accent" : "text-label-secondary"}
                    />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  </button>
                </SortableRow>
              ))}
            </SortableContext>
          </DndContext>

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

        {trackerVisible && (
          <>
            <div className="mb-1 mt-5 flex items-center px-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">{t("sidebar.tracker")}</p>
            </div>

            <nav className="flex flex-col gap-0.5">
              <button
                onClick={onSelectAllTasks}
                className={`flex w-full cursor-default items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
                  trackerActive && trackerView?.kind === "all"
                    ? "bg-accent/[0.14] font-medium text-accent"
                    : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                <ListChecks size={15} strokeWidth={1.75} className={trackerActive && trackerView?.kind === "all" ? "text-accent" : "text-label-secondary"} />
                <span className="min-w-0 flex-1 truncate">{t("tracker.allTasks")}</span>
              </button>

              <DndContext
                sensors={sensors}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleBoardDragEnd}
              >
                <SortableContext items={boardOrder.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {boardOrder.map((board) => {
                    const active = trackerActive && trackerView?.kind === "board" && trackerView.boardId === board.id;
                    return (
                      <SortableRow key={board.id} id={board.id}>
                        <button
                          onClick={() => onSelectTrackerBoard(board.id)}
                          className={`flex w-full cursor-default items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
                            active ? "bg-accent/[0.14] font-medium text-accent" : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                          }`}
                        >
                          <Kanban size={15} strokeWidth={1.75} className={active ? "text-accent" : "text-label-secondary"} />
                          <span className="min-w-0 flex-1 truncate">{board.name}</span>
                          {board.taskCount > 0 && <span className="shrink-0 text-[11px] text-label-tertiary">{board.taskCount}</span>}
                        </button>
                      </SortableRow>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </nav>

            <button
              onClick={onNewTrackerBoard}
              className="mt-1 flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] text-label-secondary transition-colors hover:bg-black/[0.04] hover:text-label-primary dark:hover:bg-white/[0.06]"
            >
              <Plus size={15} strokeWidth={1.75} />
              {t("tracker.newBoard")}
            </button>
          </>
        )}
      </div>

      <div className="no-drag border-t border-surface-border px-3 py-3">
        <button
          onClick={onOpenSettings}
          className={`relative flex w-full items-center gap-2 rounded-apple-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
            settingsActive
              ? "bg-accent/[0.14] text-accent font-medium"
              : "text-label-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          <span className="relative shrink-0">
            <SettingsIcon size={15} strokeWidth={1.75} className={settingsActive ? "text-accent" : "text-label-secondary"} />
            {updateAvailable && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-surface-sidebar" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{t("sidebar.settings")}</span>
          {updateAvailable && (
            <span className="shrink-0 text-[10.5px] font-medium text-accent">{t("settings.updateBadge")}</span>
          )}
        </button>
      </div>
    </aside>
  );
}

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-label-primary">
      <Layers size={16} className="text-accent" />
      Noxera Files
    </div>
  );
}
