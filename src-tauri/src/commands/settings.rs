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
const KEY_LAUNCH_AT_STARTUP: &str = "launch_at_startup";

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
    Ok(base.join("Project Manager").to_string_lossy().to_string())
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
        if settings_db::get(conn, KEY_LAUNCH_AT_STARTUP)?.is_none() {
            settings_db::set(conn, KEY_LAUNCH_AT_STARTUP, "false")?;
        }
        Ok(())
    })?;

    get_settings(state)
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppResult<AppSettings> {
    with_ready(&state, |conn, storage| {
        let theme = settings_db::get(conn, KEY_THEME)?.unwrap_or_else(|| "system".to_string());
        let launch_at_startup = settings_db::get(conn, KEY_LAUNCH_AT_STARTUP)?
            .map(|v| v == "true")
            .unwrap_or(false);
        Ok(AppSettings {
            theme,
            launch_at_startup,
            storage_path: storage.root().to_string_lossy().to_string(),
        })
    })
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<AppState>,
    update: SettingsUpdate,
) -> AppResult<AppSettings> {
    with_ready(&state, |conn, _| {
        if let Some(theme) = &update.theme {
            if !["system", "light", "dark"].contains(&theme.as_str()) {
                return Err(AppError::user("Invalid theme."));
            }
            settings_db::set(conn, KEY_THEME, theme)?;
        }
        if let Some(launch) = update.launch_at_startup {
            settings_db::set(
                conn,
                KEY_LAUNCH_AT_STARTUP,
                if launch { "true" } else { "false" },
            )?;
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
