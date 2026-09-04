export interface Project {
  id: string;
  name: string;
  description: string | null;
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

export interface FileEntry {
  id: string;
  projectId: string;
  name: string;
  currentVersionId: string | null;
  nextVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  currentVersion: FileVersion | null;
  versionCount: number;
}

export interface FileDetail extends FileEntry {
  versions: FileVersion[];
}

export type SortField = "name" | "lastModified" | "created" | "size";
export type SortDirection = "asc" | "desc";

export type ThemeMode = "system" | "light" | "dark";

export interface AppSettings {
  theme: ThemeMode;
  launchAtStartup: boolean;
  storagePath: string;
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
