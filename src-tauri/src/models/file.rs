use serde::{Deserialize, Serialize};

use super::version::FileVersion;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: String,
    pub project_id: String,
    pub folder_id: Option<String>,
    pub name: String,
    pub current_version_id: Option<String>,
    pub next_version_number: i64,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub current_version: Option<FileVersion>,
    pub version_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDetail {
    #[serde(flatten)]
    pub file: FileEntry,
    pub versions: Vec<FileVersion>,
}

/// One match from a cross-project search - the file plus the name of the
/// project it lives in, so results can be shown without a separate lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalFileHit {
    #[serde(flatten)]
    pub file: FileEntry,
    pub project_name: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SortField {
    Name,
    LastModified,
    Created,
    Size,
    /// Manual drag-and-drop order (`files.position`), entered automatically
    /// the first time the user drags a row.
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    Asc,
    Desc,
}
