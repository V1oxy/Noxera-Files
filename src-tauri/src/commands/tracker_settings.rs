use tauri::State;

use crate::database::settings as settings_db;
use crate::state::AppState;
use crate::utils::AppResult;

use super::with_ready;

const KEY_TRACKER_UI_STATE: &str = "tracker_ui_state";

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
