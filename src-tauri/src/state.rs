use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::models::StorageConfig;
use crate::storage::StorageRoot;
use crate::utils::{AppError, AppResult};

pub enum AppStateInner {
    Uninitialized,
    Ready {
        conn: Connection,
        storage: StorageRoot,
    },
}

pub struct AppState {
    pub inner: Mutex<AppStateInner>,
}

impl AppState {
    pub fn uninitialized() -> Self {
        Self {
            inner: Mutex::new(AppStateInner::Uninitialized),
        }
    }
}

/// Path to the small JSON file (in the OS app-config directory) that records
/// where the user chose to keep their data. This has to live outside the
/// SQLite database itself since we need it before the database can be
/// opened (spec section 8 - "Where to store data" is asked on first run).
pub fn config_file_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::with_details("Unable to locate the application config folder.", e))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("config.json"))
}

pub fn read_storage_config(app: &AppHandle) -> AppResult<Option<StorageConfig>> {
    let path = config_file_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)?;
    let config: StorageConfig = serde_json::from_str(&raw)
        .map_err(|e| AppError::with_details("The saved configuration is corrupted.", e))?;
    Ok(Some(config))
}

pub fn write_storage_config(app: &AppHandle, config: &StorageConfig) -> AppResult<()> {
    let path = config_file_path(app)?;
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::with_details("Unable to save configuration.", e))?;
    std::fs::write(path, raw)?;
    Ok(())
}

/// Opens the database + storage root at `path` and installs it into shared
/// state. Used both at startup (if config.json already points somewhere)
/// and by the `initialize_storage` command on first run.
pub fn open_storage_into_state(state: &AppState, path: PathBuf) -> AppResult<()> {
    let storage = StorageRoot::new(path);
    storage.ensure_dirs()?;
    let _ = crate::storage::cleanup_temp_dir(&storage.temp_dir());
    let conn = crate::database::open(&storage.database_path())?;
    let mut guard = state
        .inner
        .lock()
        .map_err(|_| AppError::user("Internal state error."))?;
    *guard = AppStateInner::Ready { conn, storage };
    Ok(())
}
