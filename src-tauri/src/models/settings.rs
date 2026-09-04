use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub launch_at_startup: bool,
    pub storage_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUpdate {
    pub theme: Option<String>,
    pub launch_at_startup: Option<bool>,
}

/// Persisted outside the SQLite database (in the OS app-config directory)
/// because it must be readable *before* the database can be opened.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub storage_path: String,
}
