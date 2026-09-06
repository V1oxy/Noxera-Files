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
    /// Whether the Tracker section shows up in navigation at all. Turning
    /// this off never touches tracker data (boards/tasks/etc. stay in the
    /// database untouched) - it's purely a UI visibility switch, so it can
    /// be turned back on later with everything exactly as it was.
    pub tracker_enabled: bool,
    /// Same idea as `tracker_enabled`, for the Links section.
    pub links_enabled: bool,
    /// Whether each sidebar section's item tree is collapsed (header stays
    /// visible, its list is hidden) - purely a UI convenience, independent
    /// per section, persisted so it survives a restart.
    pub sidebar_files_collapsed: bool,
    pub sidebar_tracker_collapsed: bool,
    pub sidebar_links_collapsed: bool,
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
    pub tracker_enabled: Option<bool>,
    pub links_enabled: Option<bool>,
    pub sidebar_files_collapsed: Option<bool>,
    pub sidebar_tracker_collapsed: Option<bool>,
    pub sidebar_links_collapsed: Option<bool>,
}

/// Persisted outside the SQLite database (in the OS app-config directory)
/// because it must be readable *before* the database can be opened.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub storage_path: String,
}
