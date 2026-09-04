import type { AccentColorKey } from "@/constants/accentColors";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string | null;
  checksum: string;
  description: string | null;
  createdAt: string;
}

export interface Folder {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  folderCount: number;
  fileCount: number;
}

export interface FolderPathEntry {
  id: string;
  name: string;
}

export interface ImportFolderResult {
  rootFolder: Folder;
  filesImported: number;
  foldersCreated: number;
}

export interface FileEntry {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  currentVersionId: string | null;
  nextVersionNumber: number;
  position: number;
  createdAt: string;
  updatedAt: string;
  currentVersion: FileVersion | null;
  versionCount: number;
}

export interface FileDetail extends FileEntry {
  versions: FileVersion[];
}

export interface GlobalFileHit extends FileEntry {
  projectName: string;
}

export type SortField = "name" | "lastModified" | "created" | "size" | "custom";
export type SortDirection = "asc" | "desc";

export type ThemeMode = "system" | "light" | "dark";
export type LanguageMode = "system" | "en" | "ru";

export interface AppSettings {
  theme: ThemeMode;
  language: LanguageMode;
  launchAtStartup: boolean;
  storagePath: string;
  accentColor: AccentColorKey;
}

export interface StorageInfo {
  path: string;
  totalSizeBytes: number;
  totalSizeHuman: string;
}

export interface BackupResult {
  path: string;
  sizeBytes: number;
  sizeHuman: string;
  createdAt: string;
}

export interface AppErrorPayload {
  message: string;
  details?: string | null;
}

export interface UploadProgressEvent {
  operationId: string;
  bytesWritten: number;
  totalBytes: number;
}
