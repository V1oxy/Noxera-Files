use serde::{Deserialize, Serialize};

use super::version::FileVersion;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub current_version_id: Option<String>,
    pub next_version_number: i64,
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SortField {
    Name,
    LastModified,
    Created,
    Size,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    Asc,
    Desc,
}
