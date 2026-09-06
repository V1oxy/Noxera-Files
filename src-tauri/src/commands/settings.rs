use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use walkdir::WalkDir;

use crate::database::settings as settings_db;
use crate::models::{AppSettings, SettingsUpdate, StorageConfig};
use crate::state::{self, AppState, AppStateInner};
use crate::storage::human_size;
use crate::utils::{AppError, AppResult};

use super::with_ready;

const KEY_THEME: &str = "theme";
const KEY_LANGUAGE: &str = "language";
const KEY_LAUNCH_AT_STARTUP: &str = "launch_at_startup";
const KEY_ACCENT_COLOR: &str = "accent_color";
const KEY_LAST_WHATS_NEW_VERSION: &str = "last_whats_new_version";
const KEY_PENDING_WHATS_NEW_VERSION: &str = "pending_whats_new_version";
const KEY_PENDING_WHATS_NEW_NOTES: &str = "pending_whats_new_notes";
const KEY_TRACKER_ENABLED: &str = "tracker_enabled";
const KEY_LINKS_ENABLED: &str = "links_enabled";

const ACCENT_COLORS: [&str; 10] = [
    "green", "blue", "teal", "purple", "pink", "red", "orange", "amber", "indigo", "graphite",
];

#[tauri::command]
pub fn is_initialized(state: State<AppState>) -> bool {
    matches!(
        state.inner.lock().as_deref(),
        Ok(AppStateInner::Ready { .. })
    )
}

#[tauri::command]
pub fn default_storage_path(app: AppHandle) -> AppResult<String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| AppError::with_details("Unable to determine a default location.", e))?;
    Ok(base.join("Noxera Files").to_string_lossy().to_string())
}

#[tauri::command]
pub fn initialize_storage(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> AppResult<AppSettings> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::user("Please choose a storage location."));
    }
    let path_buf = PathBuf::from(trimmed);
    std::fs::create_dir_all(&path_buf).map_err(|e| {
        AppError::with_details(
            "Unable to create the storage folder. Check that the location is available and try again.",
            e,
        )
    })?;

    let probe = path_buf.join(".pm-write-test");
    std::fs::write(&probe, b"ok")
        .map_err(|e| AppError::with_details("The chosen folder is not writable.", e))?;
    let _ = std::fs::remove_file(&probe);

    state::open_storage_into_state(&state, path_buf.clone())?;
    state::write_storage_config(
        &app,
        &StorageConfig {
            storage_path: path_buf.to_string_lossy().to_string(),
        },
    )?;

    with_ready(&state, |conn, _| {
        if settings_db::get(conn, KEY_THEME)?.is_none() {
            settings_db::set(conn, KEY_THEME, "system")?;
        }
        if settings_db::get(conn, KEY_LANGUAGE)?.is_none() {
            settings_db::set(conn, KEY_LANGUAGE, "system")?;
        }
        if settings_db::get(conn, KEY_LAUNCH_AT_STARTUP)?.is_none() {
            settings_db::set(conn, KEY_LAUNCH_AT_STARTUP, "false")?;
        }
        if settings_db::get(conn, KEY_ACCENT_COLOR)?.is_none() {
            settings_db::set(conn, KEY_ACCENT_COLOR, "green")?;
        }
        Ok(())
    })?;

    with_ready(&state, |_, storage| {
        crate::utils::logger::info(storage, &format!("Storage initialized at {}", storage.root().display()));
        Ok(())
    })?;

    get_settings(state)
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppResult<AppSettings> {
    with_ready(&state, |conn, storage| {
        let theme = settings_db::get(conn, KEY_THEME)?.unwrap_or_else(|| "system".to_string());
        let language = settings_db::get(conn, KEY_LANGUAGE)?.unwrap_or_else(|| "system".to_string());
        let launch_at_startup = settings_db::get(conn, KEY_LAUNCH_AT_STARTUP)?
            .map(|v| v == "true")
            .unwrap_or(false);
        let accent_color = settings_db::get(conn, KEY_ACCENT_COLOR)?.unwrap_or_else(|| "green".to_string());
        let last_whats_new_version = settings_db::get(conn, KEY_LAST_WHATS_NEW_VERSION)?;
        let pending_whats_new_version = settings_db::get(conn, KEY_PENDING_WHATS_NEW_VERSION)?;
        let pending_whats_new_notes = settings_db::get(conn, KEY_PENDING_WHATS_NEW_NOTES)?;
        let tracker_enabled = settings_db::get(conn, KEY_TRACKER_ENABLED)?
            .map(|v| v == "true")
            .unwrap_or(true);
        let links_enabled = settings_db::get(conn, KEY_LINKS_ENABLED)?
            .map(|v| v == "true")
            .unwrap_or(true);
        Ok(AppSettings {
            theme,
            language,
            launch_at_startup,
            storage_path: storage.root().to_string_lossy().to_string(),
            accent_color,
            last_whats_new_version,
            pending_whats_new_version,
            pending_whats_new_notes,
            tracker_enabled,
            links_enabled,
        })
    })
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<AppState>,
    update: SettingsUpdate,
) -> AppResult<AppSettings> {
    with_ready(&state, |conn, storage| {
        if let Some(theme) = &update.theme {
            if !["system", "light", "dark"].contains(&theme.as_str()) {
                return Err(AppError::user("Invalid theme."));
            }
            settings_db::set(conn, KEY_THEME, theme)?;
            crate::utils::logger::info(storage, &format!("Setting changed: theme = {theme}"));
        }
        if let Some(language) = &update.language {
            if !["system", "en", "ru"].contains(&language.as_str()) {
                return Err(AppError::user("Invalid language."));
            }
            settings_db::set(conn, KEY_LANGUAGE, language)?;
            crate::utils::logger::info(storage, &format!("Setting changed: language = {language}"));
        }
        if let Some(launch) = update.launch_at_startup {
            settings_db::set(
                conn,
                KEY_LAUNCH_AT_STARTUP,
                if launch { "true" } else { "false" },
            )?;
            crate::utils::logger::info(storage, &format!("Setting changed: launch_at_startup = {launch}"));
        }
        if let Some(accent_color) = &update.accent_color {
            if !ACCENT_COLORS.contains(&accent_color.as_str()) {
                return Err(AppError::user("Invalid accent color."));
            }
            settings_db::set(conn, KEY_ACCENT_COLOR, accent_color)?;
            crate::utils::logger::info(storage, &format!("Setting changed: accent_color = {accent_color}"));
        }
        if let Some(version) = &update.last_whats_new_version {
            settings_db::set(conn, KEY_LAST_WHATS_NEW_VERSION, version)?;
        }
        if let Some(version) = &update.pending_whats_new_version {
            settings_db::set(conn, KEY_PENDING_WHATS_NEW_VERSION, version)?;
        }
        if let Some(notes) = &update.pending_whats_new_notes {
            settings_db::set(conn, KEY_PENDING_WHATS_NEW_NOTES, notes)?;
        }
        if let Some(enabled) = update.tracker_enabled {
            settings_db::set(conn, KEY_TRACKER_ENABLED, if enabled { "true" } else { "false" })?;
            crate::utils::logger::info(storage, &format!("Setting changed: tracker_enabled = {enabled}"));
        }
        if let Some(enabled) = update.links_enabled {
            settings_db::set(conn, KEY_LINKS_ENABLED, if enabled { "true" } else { "false" })?;
            crate::utils::logger::info(storage, &format!("Setting changed: links_enabled = {enabled}"));
        }
        Ok(())
    })?;

    if let Some(launch) = update.launch_at_startup {
        let manager = app.autolaunch();
        let result = if launch { manager.enable() } else { manager.disable() };
        if let Err(e) = result {
            // Autostart registration can fail in sandboxed/CI environments;
            // the setting itself is still saved, so don't fail the request.
            eprintln!("autostart toggle failed: {e}");
            let _ = with_ready(&state, |_, storage| {
                crate::utils::logger::append(storage, &format!("Autostart toggle (launch={launch}) failed: {e}"));
                Ok(())
            });
        }
    }

    get_settings(state)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub path: String,
    pub total_size_bytes: i64,
    pub total_size_human: String,
}

#[tauri::command]
pub fn get_storage_info(state: State<AppState>) -> AppResult<StorageInfo> {
    with_ready(&state, |_, storage| {
        let mut total: i64 = 0;
        for entry in WalkDir::new(storage.root()).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                total += entry.metadata().map(|m| m.len() as i64).unwrap_or(0);
            }
        }
        Ok(StorageInfo {
            path: storage.root().to_string_lossy().to_string(),
            total_size_bytes: total,
            total_size_human: human_size(total),
        })
    })
}

#[tauri::command]
pub fn open_data_folder(app: AppHandle, state: State<AppState>, which: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let path = with_ready(&state, |_, storage| {
        Ok(match which.as_str() {
            "storage" => storage.root().to_path_buf(),
            "backups" => storage.backups_dir(),
            "logs" => storage.logs_dir(),
            _ => return Err(AppError::user("Unknown folder requested.")),
        })
    })?;
    std::fs::create_dir_all(&path)?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::with_details("Unable to open the folder.", e))
}
