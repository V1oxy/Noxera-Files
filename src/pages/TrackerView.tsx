import { Archive, LayoutGrid, Plus, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AllTasksView } from "@/components/tracker/AllTasksView";
import { BoardKanban } from "@/components/tracker/BoardKanban";
import { BoardSettingsModal } from "@/components/tracker/BoardSettingsModal";
import { NewTaskModal, type NewTaskInitialFile } from "@/components/tracker/NewTaskModal";
import { TaskDetailPanel } from "@/components/tracker/TaskDetailPanel";
import { useLanguage } from "@/hooks/useLanguage";
import { useSerialTask } from "@/hooks/useSerialTask";
import { useToast } from "@/hooks/useToast";
import type { TrackerUiState, TrackerViewState } from "@/hooks/useTracker";
import { useTrackerStatuses, useTrackerTasks } from "@/hooks/useTracker";
import { ApiError, createTrackerTask, moveTrackerTask, setTrackerBoardCardSize } from "@/services/api";
import type { CardSize, TrackerBoard } from "@/types";

interface TrackerViewProps {
  boards: TrackerBoard[];
  onBoardsChanged: () => void;
  uiState: TrackerUiState;
  updateUiState: (patch: Partial<TrackerUiState>) => void;
  pendingTaskId: string | null;
  onPendingTaskHandled: () => void;
  pendingNewTaskFile: NewTaskInitialFile | null;
  onPendingNewTaskFileHandled: () => void;
  onOpenProject: (projectId: string) => void;
}

export function TrackerView({
  boards,
  onBoardsChanged,
  uiState,
  updateUiState,
  pendingTaskId,
  onPendingTaskHandled,
  pendingNewTaskFile,
  onPendingNewTaskFileHandled,
  onOpenProject,
}: TrackerViewProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const runMove = useSerialTask();

  const view: TrackerViewState = uiState.view ?? (boards[0] ? { kind: "board", boardId: boards[0].id } : { kind: "all" });
  const board = view.kind === "board" ? boards.find((b) => b.id === view.boardId) ?? null : null;

  const [showArchived, setShowArchived] = useState(false);
  const { statuses, refresh: refreshStatuses } = useTrackerStatuses(board?.id ?? null);
  const { tasks, refresh: refreshTasks } = useTrackerTasks(board?.id ?? null, showArchived);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatusId, setNewTaskStatusId] = useState<string | null>(null);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  // AllTasksView owns its own task list (a cross-board query the board view
  // has no use for), so it can't be refreshed via `refreshTasks` above -
  // bumping this instead tells it to refetch whenever a task changes while
  // it's the active view (edited, moved, deleted, duplicated...).
  const [allTasksRefreshSignal, setAllTasksRefreshSignal] = useState(0);

  useEffect(() => {
    if (!uiState.view && boards.length > 0) {
      updateUiState({ view: { kind: "board", boardId: boards[0].id } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState.view, boards]);

  useEffect(() => {
    if (pendingTaskId) {
      setSelectedTaskId(pendingTaskId);
      onPendingTaskHandled();
    }
  }, [pendingTaskId, onPendingTaskHandled]);

  useEffect(() => {
    if (pendingNewTaskFile) {
      setNewTaskOpen(true);
    }
  }, [pendingNewTaskFile]);

  function refreshCurrentList() {
    if (board) {
      void refreshTasks();
      void refreshStatuses();
    } else {
      setAllTasksRefreshSignal((n) => n + 1);
    }
  }

  // Queued (not fired immediately) so two drags in quick succession can
  // never race each other to the backend - the second `moveTrackerTask`
  // call always waits for the first to land, instead of whichever response
  // happens to arrive last silently overwriting the other's order.
  function handleMove(taskId: string, statusId: string, orderedIds: string[]) {
    runMove(async () => {
      try {
        await moveTrackerTask(taskId, statusId, orderedIds);
        refreshCurrentList();
      } catch (e) {
        showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
        // BoardKanban already moved the card optimistically - force a
        // refetch so the board falls back to what's actually saved instead
        // of silently showing a move that was never persisted.
        void refreshTasks();
      }
    });
  }

  async function handleQuickAdd(statusId: string, title: string) {
    if (!board) return;
    try {
      await createTrackerTask({ boardId: board.id, statusId, title });
      refreshCurrentList();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleCardSizeToggle() {
    if (!board) return;
    const next: CardSize = board.cardSize === "compact" ? "normal" : "compact";
    await setTrackerBoardCardSize(board.id, next);
    onBoardsChanged();
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {view.kind === "board" && board ? (
        <>
          <div className="drag-region flex shrink-0 items-center justify-between gap-3 px-6 pb-2 pt-10">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-semibold text-label-primary">{board.name}</h1>
              {board.description && <p className="mt-0.5 truncate text-[12px] text-label-secondary">{board.description}</p>}
            </div>
            <div className="no-drag flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setShowArchived((v) => !v)}
                title={t("tracker.filterIncludeArchived")}
                className={`flex items-center gap-1.5 rounded-apple-sm px-2 py-1.5 text-[12px] ${showArchived ? "bg-accent/[0.12] text-accent" : "text-label-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"}`}
              >
                <Archive size={14} />
              </button>
              <button
                onClick={handleCardSizeToggle}
                title={t(`tracker.cardSize.${board.cardSize === "compact" ? "normal" : "compact"}`)}
                className="flex items-center gap-1.5 rounded-apple-sm px-2 py-1.5 text-[12px] text-label-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                {board.cardSize === "compact" ? <Rows3 size={14} /> : <LayoutGrid size={14} />}
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNewTaskStatusId(null);
                  setNewTaskOpen(true);
                }}
              >
                <Plus size={13} />
                {t("tracker.newTask")}
              </Button>
            </div>
          </div>

          <BoardKanban
            statuses={statuses}
            tasks={tasks}
            cardSize={board.cardSize}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onMove={handleMove}
            onQuickAdd={handleQuickAdd}
            onOpenBoardSettings={() => setBoardSettingsOpen(true)}
          />
        </>
      ) : view.kind === "board" && !board ? (
        <EmptyState title={t("tracker.boardGoneTitle")} />
      ) : (
        <>
          <div className="drag-region flex shrink-0 items-center justify-between px-6 pb-2 pt-10">
            <h1 className="text-[20px] font-semibold text-label-primary">{t("tracker.allTasks")}</h1>
            <div className="no-drag">
              <Button variant="primary" size="sm" onClick={() => { setNewTaskStatusId(null); setNewTaskOpen(true); }}>
                <Plus size={13} />
                {t("tracker.newTask")}
              </Button>
            </div>
          </div>
          <AllTasksView
            filter={uiState.allTasksFilter}
            onFilterChange={(f) => updateUiState({ allTasksFilter: f })}
            sortField={uiState.allTasksSortField}
            sortDir={uiState.allTasksSortDir}
            onSortChange={(f, d) => updateUiState({ allTasksSortField: f, allTasksSortDir: d })}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            refreshSignal={allTasksRefreshSignal}
          />
        </>
      )}

      {boards.length === 0 && view.kind === "board" && (
        <EmptyState title={t("tracker.noBoardsTitle")} description={t("tracker.noBoardsDescription")} />
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onChanged={refreshCurrentList}
          onOpenProject={onOpenProject}
          onDeleted={() => {
            setSelectedTaskId(null);
            refreshCurrentList();
          }}
        />
      )}

      <NewTaskModal
        open={newTaskOpen}
        defaultBoardId={board?.id ?? boards[0]?.id ?? null}
        defaultStatusId={newTaskStatusId}
        initialFile={pendingNewTaskFile}
        onCancel={() => {
          setNewTaskOpen(false);
          if (pendingNewTaskFile) onPendingNewTaskFileHandled();
        }}
        onCreated={(detail) => {
          setNewTaskOpen(false);
          if (pendingNewTaskFile) onPendingNewTaskFileHandled();
          refreshCurrentList();
          setSelectedTaskId(detail.id);
        }}
      />

      {board && boardSettingsOpen && (
        <BoardSettingsModal
          open={boardSettingsOpen}
          board={board}
          onClose={() => setBoardSettingsOpen(false)}
          onBoardChanged={() => {
            onBoardsChanged();
            void refreshStatuses();
          }}
          onBoardDeleted={() => {
            setBoardSettingsOpen(false);
            onBoardsChanged();
            updateUiState({ view: null });
          }}
        />
      )}
    </div>
  );
}
