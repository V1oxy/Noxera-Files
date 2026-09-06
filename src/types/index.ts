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
  lastWhatsNewVersion: string | null;
  pendingWhatsNewVersion: string | null;
  pendingWhatsNewNotes: string | null;
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

// ---- Tracker ------------------------------------------------------------------

export type Priority = "low" | "normal" | "high" | "critical";
export type TrackerFieldType = "text" | "number" | "date" | "datetime" | "select" | "boolean" | "url";
export type TaskSortField = "created" | "receivedAt" | "dueAt" | "priority" | "updatedAt" | "completedAt";
export type CardSize = "compact" | "normal";

export interface TrackerBoard {
  id: string;
  name: string;
  description: string | null;
  cardSize: CardSize;
  position: number;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
}

export interface TrackerStatus {
  id: string;
  boardId: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
}

export interface TrackerField {
  id: string;
  boardId: string;
  name: string;
  fieldType: TrackerFieldType;
  options: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrackerLabel {
  id: string;
  boardId: string;
  name: string;
  color: string;
  position: number;
  createdAt: string;
}

export interface TrackerFieldValue {
  fieldId: string;
  value: string | null;
}

export interface TrackerTaskFile {
  id: string;
  taskId: string;
  fileId: string;
  fileName: string;
  fileExists: boolean;
  projectId: string | null;
  projectName: string | null;
  folderId: string | null;
  alwaysLatest: boolean;
  versionId: string | null;
  versionExists: boolean;
  versionNumber: number | null;
  versionDate: string | null;
  fileSize: number | null;
  mimeType: string | null;
  unseenUpdate: boolean;
  addedAt: string;
}

export interface TrackerTaskEventPayload {
  [key: string]: unknown;
}

export interface TrackerTaskEvent {
  id: string;
  taskId: string;
  kind: string;
  payload: TrackerTaskEventPayload | string | number | boolean | null;
  author: string | null;
  createdAt: string;
}

export interface TrackerTask {
  id: string;
  boardId: string;
  boardName: string;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusIsDone: boolean;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  customer: string | null;
  assignee: string | null;
  priority: Priority;
  pinned: boolean;
  archived: boolean;
  position: number;
  receivedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  hasUnseenUpdate: boolean;
  labelIds: string[];
}

export interface TrackerTaskDetail extends TrackerTask {
  fieldValues: TrackerFieldValue[];
  files: TrackerTaskFile[];
  events: TrackerTaskEvent[];
}

export interface TrackerBoardInput {
  name: string;
  description?: string | null;
}

export interface TrackerStatusInput {
  name: string;
  color: string;
}

export interface TrackerFieldInput {
  name: string;
  fieldType: TrackerFieldType;
  options: string[];
}

export interface TrackerLabelInput {
  name: string;
  color: string;
}

export interface NewTrackerTaskFile {
  fileId: string;
  versionId?: string | null;
  alwaysLatest: boolean;
}

export interface TrackerTaskInput {
  boardId: string;
  statusId?: string | null;
  title: string;
  description?: string | null;
  projectId?: string | null;
  customer?: string | null;
  assignee?: string | null;
  priority?: Priority;
  receivedAt?: string | null;
  dueAt?: string | null;
  labelIds?: string[];
  fieldValues?: TrackerFieldValue[];
  files?: NewTrackerTaskFile[];
}

/**
 * Every field is optional and means "leave unchanged" when omitted - set it
 * to `null` (not just leave it out) to clear a nullable field, matching the
 * Rust side's serde "double option" patch semantics.
 */
export interface TrackerTaskUpdateInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  customer?: string | null;
  assignee?: string | null;
  priority?: Priority;
  receivedAt?: string;
  dueAt?: string | null;
  completedAt?: string | null;
  pinned?: boolean;
}

export interface DuplicateTaskOptions {
  description: boolean;
  fieldValues: boolean;
  priority: boolean;
  assignee: boolean;
  files: boolean;
  dueAt: boolean;
}

export interface TrackerTaskFilter {
  search?: string;
  projectId?: string;
  boardId?: string;
  statusId?: string;
  customer?: string;
  assignee?: string;
  priority?: Priority;
  labelId?: string;
  hasFiles?: boolean;
  overdueOnly?: boolean;
  includeArchived?: boolean;
  dueBefore?: string;
  dueAfter?: string;
  receivedBefore?: string;
  receivedAfter?: string;
  sortField?: TaskSortField;
  sortDir?: SortDirection;
}

export interface PriorityConfig {
  label: string;
  color: string;
}

export interface CardDisplayConfig {
  showProject: boolean;
  showPriority: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showFileCount: boolean;
  showUpdateIndicator: boolean;
}

export interface TrackerSettings {
  priorities: Record<string, PriorityConfig>;
  cardDisplay: CardDisplayConfig;
}
