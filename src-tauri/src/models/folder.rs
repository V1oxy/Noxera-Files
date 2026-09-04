use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub project_id: String,
    pub parent_folder_id: Option<String>,
    pub name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub folder_count: i64,
    pub file_count: i64,
}

/// A single breadcrumb entry (root-to-leaf order) for the folder navigation bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPathEntry {
    pub id: String,
    pub name: String,
}
