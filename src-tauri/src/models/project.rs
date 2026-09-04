use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    /// Number of logical files currently in the project (computed).
    pub file_count: i64,
}
