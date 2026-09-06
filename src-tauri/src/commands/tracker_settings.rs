use tauri::State;

use crate::database::settings as settings_db;
use crate::models::TrackerSettings;
use crate::state::AppState;
use crate::utils::{AppError, AppResult};

use super::with_ready;

const KEY_TRACKER_SETTINGS: &str = "tracker_settings";
const KEY_TRACKER_UI_STATE: &str = "tracker_ui_state";

#[tauri::command]
pub fn get_tracker_settings(state: State<AppState>) -> AppResult<TrackerSettings> {
    with_ready(&state, |conn, _| {
        Ok(match settings_db::get(conn, KEY_TRACKER_SETTINGS)? {
            Some(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            None => TrackerSettings::default(),
        })
    })
}

#[tauri::command]
pub fn update_tracker_settings(state: State<AppState>, settings: TrackerSettings) -> AppResult<TrackerSettings> {
    with_ready(&state, |conn, _| {
        let raw = serde_json::to_string(&settings)
            .map_err(|e| AppError::with_details("Unable to save tracker settings.", e))?;
        settings_db::set(conn, KEY_TRACKER_SETTINGS, &raw)?;
        Ok(settings)
    })
}

/// Opaque, frontend-owned blob (last opened board, filters, sort, card size,
/// sidebar state - spec section 35) - the backend just persists whatever
/// JSON string it's handed and hands the same one back, no schema of its own
/// to keep in sync as the frontend's saved-state shape grows.
#[tauri::command]
pub fn get_tracker_ui_state(state: State<AppState>) -> AppResult<Option<String>> {
    with_ready(&state, |conn, _| Ok(settings_db::get(conn, KEY_TRACKER_UI_STATE)?))
}

#[tauri::command]
pub fn set_tracker_ui_state(state: State<AppState>, value: String) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        settings_db::set(conn, KEY_TRACKER_UI_STATE, &value)?;
        Ok(())
    })
}
