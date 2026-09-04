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
  FileDetail,
  FileEntry,
  FileVersion,
  Folder,
  FolderPathEntry,
  Project,
  SortDirection,
  SortField,
  StorageInfo,
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

export const getFile = (fileId: string) => call<FileDetail>("get_file", { fileId });
export const renameFile = (fileId: string, newName: string) =>
  call<FileEntry>("rename_file", { fileId, newName });
export const reorderFiles = (orderedIds: string[]) => call<void>("reorder_files", { orderedIds });
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
