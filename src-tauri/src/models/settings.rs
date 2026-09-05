use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub launch_at_startup: bool,
    pub storage_path: String,
    pub accent_color: String,
    /// App version the "What's new" popup was last shown (or skipped) for -
    /// `None` only before this feature has ever run once.
    pub last_whats_new_version: Option<String>,
    /// The version + release notes captured right after an in-app update
    /// downloads, so the next launch can show "What's new" without a
    /// network call. Cleared (set to "") once consumed.
    pub pending_whats_new_version: Option<String>,
    pub pending_whats_new_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUpdate {
    pub theme: Option<String>,
    pub language: Option<String>,
    pub launch_at_startup: Option<bool>,
    pub accent_color: Option<String>,
    pub last_whats_new_version: Option<String>,
    pub pending_whats_new_version: Option<String>,
    pub pending_whats_new_notes: Option<String>,
}

/// Persisted outside the SQLite database (in the OS app-config directory)
/// because it must be readable *before* the database can be opened.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub storage_path: String,
}
