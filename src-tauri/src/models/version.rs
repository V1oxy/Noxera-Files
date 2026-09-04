use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileVersion {
    pub id: String,
    pub file_id: String,
    pub version_number: i64,
    /// Path relative to the storage root, e.g. `projects/<pid>/files/<fid>/v3/name.docx`.
    pub storage_path: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub checksum: String,
    pub description: Option<String>,
    pub created_at: String,
}
