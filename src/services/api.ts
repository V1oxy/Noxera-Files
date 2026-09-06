import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";

import type {
  AppErrorPayload,
  AppSettings,
  BackupResult,
  DuplicateTaskOptions,
  FileDetail,
  FileEntry,
  FileVersion,
  Folder,
  FolderPathEntry,
  GlobalFileHit,
  ImportFolderResult,
  NewTrackerTaskFile,
  Project,
  SortDirection,
  SortField,
  StorageInfo,
  TrackerBoard,
  TrackerBoardInput,
  TrackerField,
  TrackerFieldInput,
  TrackerFieldValue,
  TrackerLabel,
  TrackerLabelInput,
  TrackerPriority,
  TrackerPriorityInput,
  TrackerSettings,
  TrackerStatus,
  TrackerStatusInput,
  TrackerTask,
  TrackerTaskDetail,
  TrackerTaskEvent,
  TrackerTaskFilter,
  TrackerTaskInput,
  TrackerTaskUpdateInput,
  UploadProgressEvent,
} from "@/types";

/** Friendly wrapper so every call site gets a consistent {message, details} shape. */
export class ApiError extends Error {
  details?: string | null;
  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.details = payload.details ?? null;
  }
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    if (e && typeof e === "object" && "message" in e) {
      throw new ApiError(e as AppErrorPayload);
    }
    throw new ApiError({ message: "Something went wrong. Please try again.", details: String(e) });
  }
}

// ---- Onboarding / storage setup -------------------------------------------------

export const isInitialized = () => call<boolean>("is_initialized");
export const defaultStoragePath = () => call<string>("default_storage_path");
export const initializeStorage = (path: string) =>
  call<AppSettings>("initialize_storage", { path });

export async function pickStorageFolder(): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

// ---- Settings ---------------------------------------------------------------

export const getSettings = () => call<AppSettings>("get_settings");
export const updateSettings = (update: {
  theme?: string;
  language?: string;
  launchAtStartup?: boolean;
  accentColor?: string;
  lastWhatsNewVersion?: string;
  pendingWhatsNewVersion?: string;
  pendingWhatsNewNotes?: string;
  trackerEnabled?: boolean;
}) => call<AppSettings>("update_settings", { update });
export const getStorageInfo = () => call<StorageInfo>("get_storage_info");
export const openDataFolder = (which: "storage" | "backups" | "logs") =>
  call<void>("open_data_folder", { which });
export const createBackup = () => call<BackupResult>("create_backup");

// ---- Projects -----------------------------------------------------------------

export const getProjects = () => call<Project[]>("get_projects");
export const getProject = (projectId: string) => call<Project>("get_project", { projectId });
export const createProject = (name: string, description?: string) =>
  call<Project>("create_project", { name, description: description || null });
export const updateProject = (projectId: string, name: string, description?: string) =>
  call<Project>("update_project", { projectId, name, description: description || null });
export const reorderProjects = (orderedIds: string[]) =>
  call<Project[]>("reorder_projects", { orderedIds });
export const deleteProject = (projectId: string) => call<void>("delete_project", { projectId });

// ---- Files ----------------------------------------------------------------------

export const getFiles = (
  projectId: string,
  opts?: { folderId?: string | null; search?: string; sortField?: SortField; sortDir?: SortDirection },
) =>
  call<FileEntry[]>("get_files", {
    projectId,
    folderId: opts?.folderId ?? null,
    search: opts?.search || null,
    sortField: opts?.sortField ?? null,
    sortDir: opts?.sortDir ?? null,
  });

export const searchFilesGlobal = (search: string) =>
  call<GlobalFileHit[]>("search_files_global", { search });

export const getFile = (fileId: string) => call<FileDetail>("get_file", { fileId });
export const renameFile = (fileId: string, newName: string) =>
  call<FileEntry>("rename_file", { fileId, newName });
export const reorderFiles = (orderedIds: string[]) => call<void>("reorder_files", { orderedIds });
export const moveFile = (fileId: string, folderId: string | null) =>
  call<FileEntry>("move_file", { fileId, folderId });
export const deleteFile = (fileId: string) => call<void>("delete_file", { fileId });

// ---- Folders --------------------------------------------------------------------

export const getFolders = (projectId: string, parentFolderId?: string | null) =>
  call<Folder[]>("get_folders", { projectId, parentFolderId: parentFolderId ?? null });
export const getFolderPath = (folderId: string) =>
  call<FolderPathEntry[]>("get_folder_path", { folderId });
export const createFolder = (projectId: string, parentFolderId: string | null, name: string) =>
  call<Folder>("create_folder", { projectId, parentFolderId, name });
export const renameFolder = (folderId: string, newName: string) =>
  call<Folder>("rename_folder", { folderId, newName });
export const reorderFolders = (orderedIds: string[]) => call<void>("reorder_folders", { orderedIds });
export const moveFolder = (folderId: string, parentFolderId: string | null) =>
  call<Folder>("move_folder", { folderId, parentFolderId });
export const deleteFolder = (folderId: string) => call<void>("delete_folder", { folderId });

// ---- Versions ---------------------------------------------------------------

export const getVersions = (fileId: string) => call<FileVersion[]>("get_versions", { fileId });

export async function pickFilesToUpload(multiple = true): Promise<string[]> {
  const selected = await openDialog({ directory: false, multiple });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export const uploadFile = (
  projectId: string,
  folderId: string | null,
  sourcePath: string,
  description?: string,
  operationId?: string,
) =>
  call<FileEntry>("upload_file", {
    projectId,
    folderId,
    sourcePath,
    description: description || null,
    operationId: operationId || null,
  });

export const pathIsDirectory = (path: string) => call<boolean>("path_is_directory", { path });

export const importFolder = (projectId: string, parentFolderId: string | null, sourcePath: string) =>
  call<ImportFolderResult>("import_folder", { projectId, parentFolderId, sourcePath });

export const uploadNewVersion = (
  fileId: string,
  sourcePath: string,
  description?: string,
  operationId?: string,
) =>
  call<FileEntry>("upload_new_version", {
    fileId,
    sourcePath,
    description: description || null,
    operationId: operationId || null,
  });

export const restoreVersion = (fileId: string, versionId: string, description?: string) =>
  call<FileEntry>("restore_version", { fileId, versionId, description: description || null });

export const updateVersionDescription = (versionId: string, description: string) =>
  call<FileVersion>("update_version_description", { versionId, description: description || null });

export const deleteVersion = (versionId: string) =>
  call<FileEntry | null>("delete_version", { versionId });

export const openVersion = (versionId: string) => call<void>("open_version", { versionId });

export async function downloadVersion(versionId: string, defaultFilename: string): Promise<boolean> {
  const dest = await saveDialog({ defaultPath: defaultFilename });
  if (!dest) return false;
  await call<void>("download_version", { versionId, destPath: dest });
  return true;
}

export function onUploadProgress(handler: (e: UploadProgressEvent) => void): Promise<UnlistenFn> {
  return listen<UploadProgressEvent>("upload-progress", (event) => handler(event.payload));
}

// ---- Tracker: boards ------------------------------------------------------------

export const getTrackerBoards = () => call<TrackerBoard[]>("get_tracker_boards");
export const createTrackerBoard = (input: TrackerBoardInput) => call<TrackerBoard>("create_tracker_board", { input });
export const updateTrackerBoard = (boardId: string, input: TrackerBoardInput) =>
  call<TrackerBoard>("update_tracker_board", { boardId, input });
export const setTrackerBoardCardSize = (boardId: string, cardSize: "compact" | "normal") =>
  call<TrackerBoard>("set_tracker_board_card_size", { boardId, cardSize });
export const reorderTrackerBoards = (orderedIds: string[]) =>
  call<TrackerBoard[]>("reorder_tracker_boards", { orderedIds });
export const deleteTrackerBoard = (boardId: string) => call<void>("delete_tracker_board", { boardId });

// ---- Tracker: statuses ------------------------------------------------------------

export const getTrackerStatuses = (boardId: string) => call<TrackerStatus[]>("get_tracker_statuses", { boardId });
export const createTrackerStatus = (boardId: string, input: TrackerStatusInput) =>
  call<TrackerStatus>("create_tracker_status", { boardId, input });
export const updateTrackerStatus = (statusId: string, input: TrackerStatusInput) =>
  call<TrackerStatus>("update_tracker_status", { statusId, input });
export const setTrackerStatusDefault = (statusId: string) =>
  call<TrackerStatus[]>("set_tracker_status_default", { statusId });
export const setTrackerStatusIsDone = (statusId: string, isDone: boolean) =>
  call<TrackerStatus>("set_tracker_status_is_done", { statusId, isDone });
export const reorderTrackerStatuses = (orderedIds: string[]) =>
  call<void>("reorder_tracker_statuses", { orderedIds });
export const deleteTrackerStatus = (statusId: string, reassignToStatusId?: string | null) =>
  call<void>("delete_tracker_status", { statusId, reassignToStatusId: reassignToStatusId ?? null });

// ---- Tracker: custom fields ---------------------------------------------------

export const getTrackerFields = (boardId: string) => call<TrackerField[]>("get_tracker_fields", { boardId });
export const createTrackerField = (boardId: string, input: TrackerFieldInput) =>
  call<TrackerField>("create_tracker_field", { boardId, input });
export const updateTrackerField = (fieldId: string, input: TrackerFieldInput) =>
  call<TrackerField>("update_tracker_field", { fieldId, input });
export const reorderTrackerFields = (orderedIds: string[]) => call<void>("reorder_tracker_fields", { orderedIds });
export const deleteTrackerField = (fieldId: string) => call<void>("delete_tracker_field", { fieldId });

// ---- Tracker: labels ------------------------------------------------------------

export const getTrackerLabels = (boardId: string) => call<TrackerLabel[]>("get_tracker_labels", { boardId });
export const createTrackerLabel = (boardId: string, input: TrackerLabelInput) =>
  call<TrackerLabel>("create_tracker_label", { boardId, input });
export const updateTrackerLabel = (labelId: string, input: TrackerLabelInput) =>
  call<TrackerLabel>("update_tracker_label", { labelId, input });
export const reorderTrackerLabels = (orderedIds: string[]) => call<void>("reorder_tracker_labels", { orderedIds });
export const deleteTrackerLabel = (labelId: string) => call<void>("delete_tracker_label", { labelId });

// ---- Tracker: priorities ----------------------------------------------------

export const getTrackerPriorities = (boardId: string) => call<TrackerPriority[]>("get_tracker_priorities", { boardId });
export const createTrackerPriority = (boardId: string, input: TrackerPriorityInput) =>
  call<TrackerPriority>("create_tracker_priority", { boardId, input });
export const updateTrackerPriority = (priorityId: string, input: TrackerPriorityInput) =>
  call<TrackerPriority>("update_tracker_priority", { priorityId, input });
export const setTrackerPriorityDefault = (priorityId: string) =>
  call<TrackerPriority[]>("set_tracker_priority_default", { priorityId });
export const reorderTrackerPriorities = (orderedIds: string[]) =>
  call<void>("reorder_tracker_priorities", { orderedIds });
export const deleteTrackerPriority = (priorityId: string, reassignToPriorityId?: string | null) =>
  call<void>("delete_tracker_priority", { priorityId, reassignToPriorityId: reassignToPriorityId ?? null });

// ---- Tracker: tasks ---------------------------------------------------------------

export const getTrackerTasks = (boardId: string, includeArchived?: boolean) =>
  call<TrackerTask[]>("get_tracker_tasks", { boardId, includeArchived: includeArchived ?? null });
export const getAllTrackerTasks = (filter: TrackerTaskFilter) =>
  call<TrackerTask[]>("get_all_tracker_tasks", { filter });
export const getProjectTrackerTasks = (projectId: string) =>
  call<TrackerTask[]>("get_project_tracker_tasks", { projectId });
export const getFileTrackerTasks = (fileId: string) => call<TrackerTask[]>("get_file_tracker_tasks", { fileId });
export const getTrackerTask = (taskId: string) => call<TrackerTaskDetail>("get_tracker_task", { taskId });
export const createTrackerTask = (input: TrackerTaskInput) => call<TrackerTaskDetail>("create_tracker_task", { input });
export const updateTrackerTask = (taskId: string, patch: TrackerTaskUpdateInput) =>
  call<TrackerTaskDetail>("update_tracker_task", { taskId, patch });
export const setTrackerTaskFieldValues = (taskId: string, values: TrackerFieldValue[]) =>
  call<TrackerTaskDetail>("set_tracker_task_field_values", { taskId, values });
export const setTrackerTaskLabels = (taskId: string, labelIds: string[]) =>
  call<TrackerTaskDetail>("set_tracker_task_labels", { taskId, labelIds });
export const moveTrackerTask = (taskId: string, statusId: string, orderedIds: string[]) =>
  call<TrackerTask>("move_tracker_task", { taskId, statusId, orderedIds });
export const setTrackerTaskPinned = (taskId: string, pinned: boolean) =>
  call<TrackerTask>("set_tracker_task_pinned", { taskId, pinned });
export const setTrackerTaskArchived = (taskId: string, archived: boolean) =>
  call<TrackerTask>("set_tracker_task_archived", { taskId, archived });
export const deleteTrackerTask = (taskId: string) => call<void>("delete_tracker_task", { taskId });
export const duplicateTrackerTask = (taskId: string, options: DuplicateTaskOptions) =>
  call<TrackerTaskDetail>("duplicate_tracker_task", { taskId, options });
export const attachTrackerTaskFile = (taskId: string, file: NewTrackerTaskFile) =>
  call<TrackerTaskDetail>("attach_tracker_task_file", { taskId, file });
export const detachTrackerTaskFile = (taskFileId: string) =>
  call<TrackerTaskDetail>("detach_tracker_task_file", { taskFileId });
export const setTrackerTaskFilePin = (taskFileId: string, alwaysLatest: boolean) =>
  call<TrackerTaskDetail>("set_tracker_task_file_pin", { taskFileId, alwaysLatest });
export const addTrackerTaskLocalFile = (taskId: string, sourcePath: string) =>
  call<TrackerTaskDetail>("add_tracker_task_local_file", { taskId, sourcePath });
export const removeTrackerTaskLocalFile = (localFileId: string) =>
  call<TrackerTaskDetail>("remove_tracker_task_local_file", { localFileId });
export const openTrackerTaskLocalFile = (localFileId: string) =>
  call<void>("open_tracker_task_local_file", { localFileId });
export const addTrackerTaskComment = (taskId: string, text: string) =>
  call<TrackerTaskEvent>("add_tracker_task_comment", { taskId, text });

// ---- Tracker: settings ---------------------------------------------------------

export const getTrackerSettings = () => call<TrackerSettings>("get_tracker_settings");
export const updateTrackerSettings = (settings: TrackerSettings) =>
  call<TrackerSettings>("update_tracker_settings", { settings });
export const getTrackerUiState = () => call<string | null>("get_tracker_ui_state");
export const setTrackerUiState = (value: string) => call<void>("set_tracker_ui_state", { value });
