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
  trackerEnabled: boolean;
  linksEnabled: boolean;
  sidebarFilesCollapsed: boolean;
  sidebarTrackerCollapsed: boolean;
  sidebarLinksCollapsed: boolean;
  /** Order the Files/Tracker/Links sections render in the sidebar - always
   * a permutation of `SidebarSectionKey`. */
  sidebarSectionOrder: SidebarSectionKey[];
}

export type SidebarSectionKey = "files" | "tracker" | "links";

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

export type TrackerFieldType = "text" | "number" | "date" | "datetime" | "select" | "boolean" | "url";
export type TaskSortField = "created" | "receivedAt" | "priority" | "updatedAt" | "completedAt" | "title" | "customer";
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
  /** Tasks moved into this status are automatically archived (and, moving
   * back out of it into a non-archiving status, un-archived again). */
  moveToArchive: boolean;
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
  /** Pre-filled automatically when a new task is created on this board. */
  defaultValue: string | null;
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

export interface TrackerPriority {
  id: string;
  boardId: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
}

export interface TrackerFieldValue {
  fieldId: string;
  value: string | null;
}

export interface TrackerTaskLocalFileVersion {
  id: string;
  localFileId: string;
  versionNumber: number;
  fileSize: number;
  mimeType: string | null;
  addedAt: string;
}

export interface TrackerTaskLocalFile {
  id: string;
  taskId: string;
  fileName: string;
  /** Current version's size/type - kept alongside `versions` so a caller
   * that only cares about "the file as it is now" doesn't need to look
   * inside the version list. */
  fileSize: number;
  mimeType: string | null;
  addedAt: string;
  currentVersionId: string | null;
  versionCount: number;
  /** Every version, newest first. Empty for callers that only fetch
   * current-version metadata. */
  versions: TrackerTaskLocalFileVersion[];
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
  priorityId: string;
  priorityName: string;
  priorityColor: string;
  priorityPosition: number;
  pinned: boolean;
  archived: boolean;
  position: number;
  receivedAt: string;
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
  localFiles: TrackerTaskLocalFile[];
  events: TrackerTaskEvent[];
}

export interface TrackerBoardInput {
  name: string;
  description?: string | null;
}

export interface TrackerStatusInput {
  name: string;
  color: string;
  moveToArchive: boolean;
}

export interface TrackerFieldInput {
  name: string;
  fieldType: TrackerFieldType;
  options: string[];
  defaultValue?: string | null;
}

export interface TrackerLabelInput {
  name: string;
  color: string;
}

export interface TrackerPriorityInput {
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
  priorityId?: string;
  receivedAt?: string | null;
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
  priorityId?: string;
  receivedAt?: string;
  completedAt?: string | null;
  pinned?: boolean;
}

export interface DuplicateTaskOptions {
  description: boolean;
  fieldValues: boolean;
  priority: boolean;
  files: boolean;
}

export interface TrackerTaskFilter {
  search?: string;
  projectId?: string;
  boardId?: string;
  statusId?: string;
  customer?: string;
  priorityId?: string;
  labelId?: string;
  hasFiles?: boolean;
  includeArchived?: boolean;
  receivedBefore?: string;
  receivedAfter?: string;
  sortField?: TaskSortField;
  sortDir?: SortDirection;
  /** Page size - omitted means "every match" (only the Excel export wants
   * that; the All Tasks view always sets one). */
  limit?: number;
  /** Rows to skip before `limit` applies; omitted means 0. */
  offset?: number;
}

/** Scopes an Excel export - `statusIds` empty means "every status".
 * `dateFrom`/`dateTo` are plain `YYYY-MM-DD` dates (inclusive), filtered
 * against the same `receivedAt` field the tracker already treats as a
 * task's "created/received" date. */
export interface TrackerExportFilter {
  projectId?: string;
  statusIds: string[];
  dateFrom: string;
  dateTo: string;
}

export interface CardDisplayConfig {
  showProject: boolean;
  showPriority: boolean;
  showFileCount: boolean;
  showUpdateIndicator: boolean;
}

// ---- Links ----------------------------------------------------------------------

/** A user-created top-level container for links, independent of `Project`. */
export interface LinkProject {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  linkCount: number;
}

export interface LinkProjectInput {
  name: string;
}

export interface LinkGroup {
  id: string;
  projectId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  linkCount: number;
}

export interface Link {
  id: string;
  projectId: string;
  projectName: string;
  groupId: string | null;
  groupName: string | null;
  title: string;
  url: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkGroupInput {
  name: string;
}

export interface LinkInput {
  projectId: string;
  groupId?: string | null;
  title: string;
  url: string;
  description?: string | null;
}

/**
 * Every field optional and means "leave unchanged" when omitted - set to
 * `null` (not just leave it out) to clear a nullable field, matching the
 * Rust side's serde "double option" patch semantics (see tracker task
 * updates for the same pattern).
 */
export interface LinkUpdateInput {
  title?: string;
  url?: string;
  description?: string | null;
  groupId?: string | null;
}

export interface LinkFilter {
  search?: string;
  projectId?: string;
  /** Page size - omitted defaults to a fixed page server-side. */
  limit?: number;
  /** Rows to skip before `limit` applies; omitted means 0. */
  offset?: number;
}
