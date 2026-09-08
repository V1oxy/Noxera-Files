import { Archive, FileSpreadsheet, LayoutGrid, Plus, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { DeleteModal } from "@/components/DeleteModal";
import { EmptyState } from "@/components/EmptyState";
import { AllTasksView } from "@/components/tracker/AllTasksView";
import { BoardKanban } from "@/components/tracker/BoardKanban";
import { BoardSettingsModal } from "@/components/tracker/BoardSettingsModal";
import { ExportExcelModal } from "@/components/tracker/ExportExcelModal";
import { NewTaskModal, type NewTaskInitialFile, type NewTaskInitialLink } from "@/components/tracker/NewTaskModal";
import { TaskDetailPanel } from "@/components/tracker/TaskDetailPanel";
import { useLanguage } from "@/hooks/useLanguage";
import { useSerialTask } from "@/hooks/useSerialTask";
import { useToast } from "@/hooks/useToast";
import type { TrackerUiState, TrackerViewState } from "@/hooks/useTracker";
import { useTrackerPriorities, useTrackerStatuses, useTrackerTasks } from "@/hooks/useTracker";
import { ApiError, createTrackerTask, deleteTrackerTask, moveTrackerTask, setTrackerBoardCardSize, updateTrackerTask } from "@/services/api";
import type { CardSize, TrackerBoard, TrackerTask } from "@/types";

interface TrackerViewProps {
  boards: TrackerBoard[];
  onBoardsChanged: () => void;
  uiState: TrackerUiState;
  updateUiState: (patch: Partial<TrackerUiState>) => void;
  pendingTaskId: string | null;
  onPendingTaskHandled: () => void;
  pendingNewTaskFile: NewTaskInitialFile | null;
  onPendingNewTaskFileHandled: () => void;
  pendingNewTaskLink: NewTaskInitialLink | null;
  onPendingNewTaskLinkHandled: () => void;
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
  pendingNewTaskLink,
  onPendingNewTaskLinkHandled,
  onOpenProject,
}: TrackerViewProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const runMove = useSerialTask();

  const view: TrackerViewState = uiState.view ?? (boards[0] ? { kind: "board", boardId: boards[0].id } : { kind: "all" });
  const board = view.kind === "board" ? boards.find((b) => b.id === view.boardId) ?? null : null;

  const [showArchived, setShowArchived] = useState(false);
  const { statuses, refresh: refreshStatuses } = useTrackerStatuses(board?.id ?? null);
  const { priorities } = useTrackerPriorities(board?.id ?? null);
  const {
    tasks,
    columnHasMore,
    columnLoadingMore,
    refresh: refreshTasks,
    loadMoreForStatus,
  } = useTrackerTasks(board?.id ?? null, showArchived);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatusId, setNewTaskStatusId] = useState<string | null>(null);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Set by a right-click "Delete Task" from the Kanban card or All Tasks row
  // context menu - a lighter-weight confirm flow than opening the full
  // TaskDetailPanel just to delete a task.
  const [contextDeleteTarget, setContextDeleteTarget] = useState<TrackerTask | null>(null);
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

  useEffect(() => {
    if (pendingNewTaskLink) {
      setNewTaskOpen(true);
    }
  }, [pendingNewTaskLink]);

  // Every task mutation that can change a board's (non-archived) task count
  // - create, delete, archive/unarchive, duplicate, move between boards
  // isn't possible so status/priority edits don't need this - funnels
  // through here, so the sidebar's per-board counts (which only ever
  // refetch when `onBoardsChanged` is called) never go stale after one.
  // Previously only the board view's own list/status refresh happened here,
  // leaving the sidebar showing a task count from before the change - most
  // visibly after deleting a board's last task, which left it showing 1
  // until something unrelated happened to trigger a boards refetch.
  function refreshCurrentList() {
    if (board) {
      void refreshTasks();
      void refreshStatuses();
    } else {
      setAllTasksRefreshSignal((n) => n + 1);
    }
    onBoardsChanged();
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

  // Right-click "Change Status"/"Change Priority" on a Kanban card or an
  // All Tasks row - same underlying calls as the detail panel's own status/
  // priority pickers, just reachable without opening it first.
  async function handleContextChangeStatus(task: TrackerTask, statusId: string) {
    try {
      await moveTrackerTask(task.id, statusId, [task.id]);
      refreshCurrentList();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleContextChangePriority(task: TrackerTask, priorityId: string) {
    try {
      await updateTrackerTask(task.id, { priorityId });
      refreshCurrentList();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  async function handleContextDelete() {
    if (!contextDeleteTarget) return;
    await deleteTrackerTask(contextDeleteTarget.id);
    setContextDeleteTarget(null);
    if (selectedTaskId === contextDeleteTarget.id) setSelectedTaskId(null);
    refreshCurrentList();
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
              <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                <FileSpreadsheet size={13} />
                {t("tracker.export.button")}
              </Button>
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
            boardId={board.id}
            statuses={statuses}
            tasks={tasks}
            priorities={priorities}
            cardSize={board.cardSize}
            columnHasMore={columnHasMore}
            columnLoadingMore={columnLoadingMore}
            onLoadMoreForStatus={loadMoreForStatus}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onMove={handleMove}
            onQuickAdd={handleQuickAdd}
            onOpenBoardSettings={() => setBoardSettingsOpen(true)}
            onChangeStatus={handleContextChangeStatus}
            onChangePriority={handleContextChangePriority}
            onDeleteRequest={setContextDeleteTarget}
          />
        </>
      ) : view.kind === "board" && !board ? (
        <EmptyState title={t("tracker.boardGoneTitle")} />
      ) : (
        <>
          <div className="drag-region flex shrink-0 items-center justify-between px-6 pb-2 pt-10">
            <h1 className="text-[20px] font-semibold text-label-primary">{t("tracker.allTasks")}</h1>
            <div className="no-drag flex shrink-0 items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                <FileSpreadsheet size={13} />
                {t("tracker.export.button")}
              </Button>
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
            onChangeStatus={handleContextChangeStatus}
            onChangePriority={handleContextChangePriority}
            onDeleteRequest={setContextDeleteTarget}
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
        initialLink={pendingNewTaskLink}
        onCancel={() => {
          setNewTaskOpen(false);
          if (pendingNewTaskFile) onPendingNewTaskFileHandled();
          if (pendingNewTaskLink) onPendingNewTaskLinkHandled();
        }}
        onCreated={(detail) => {
          setNewTaskOpen(false);
          if (pendingNewTaskFile) onPendingNewTaskFileHandled();
          if (pendingNewTaskLink) onPendingNewTaskLinkHandled();
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

      <ExportExcelModal
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onExported={() => {
          setExportOpen(false);
          showToast({ title: t("tracker.export.success"), variant: "success" });
        }}
      />

      <DeleteModal
        open={contextDeleteTarget !== null}
        title={t("tracker.deleteTaskTitle")}
        message={t("tracker.deleteTaskMessage")}
        onCancel={() => setContextDeleteTarget(null)}
        onConfirm={handleContextDelete}
      />
    </div>
  );
}
