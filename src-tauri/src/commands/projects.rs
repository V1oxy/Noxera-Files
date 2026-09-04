use tauri::State;

use crate::database::projects as db;
use crate::models::Project;
use crate::state::AppState;
use crate::storage::remove_dir_all_if_exists;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

#[tauri::command]
pub fn get_projects(state: State<AppState>) -> AppResult<Vec<Project>> {
    with_ready(&state, |conn, _| Ok(db::list(conn)?))
}

#[tauri::command]
pub fn get_project(state: State<AppState>, project_id: String) -> AppResult<Project> {
    with_ready(&state, |conn, _| {
        db::get(conn, &project_id)?.ok_or_else(|| AppError::user("This project no longer exists."))
    })
}

#[tauri::command]
pub fn create_project(
    state: State<AppState>,
    name: String,
    description: Option<String>,
) -> AppResult<Project> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Project name cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        let id = crate::utils::id::new_id();
        let now = now_iso();
        db::create(conn, &id, &name, description.as_deref(), &now)?;
        crate::utils::logger::info(storage, &format!("Project created: \"{name}\" ({id})"));
        db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create project."))
    })
}

#[tauri::command]
pub fn update_project(
    state: State<AppState>,
    project_id: String,
    name: String,
    description: Option<String>,
) -> AppResult<Project> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Project name cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        let now = now_iso();
        let updated = db::update(conn, &project_id, &name, description.as_deref(), &now)?;
        if updated == 0 {
            return Err(AppError::user("This project no longer exists."));
        }
        crate::utils::logger::info(storage, &format!("Project updated: \"{name}\" ({project_id})"));
        db::get(conn, &project_id)?.ok_or_else(|| AppError::user("Failed to update project."))
    })
}

/// Persists a new manual order for the whole project list: `ordered_ids[i]`
/// gets position `i`. Called after a drag-and-drop reorder in the sidebar.
#[tauri::command]
pub fn reorder_projects(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<Vec<Project>> {
    with_ready(&state, |conn, storage| {
        for (i, id) in ordered_ids.iter().enumerate() {
            db::set_position(conn, id, i as i64)?;
        }
        crate::utils::logger::info(storage, &format!("Projects reordered ({} items)", ordered_ids.len()));
        Ok(db::list(conn)?)
    })
}

#[tauri::command]
pub fn delete_project(state: State<AppState>, project_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if !db::exists(conn, &project_id)? {
            return Err(AppError::user("This project no longer exists."));
        }
        // Delete the DB rows first (cascades to files/file_versions) so the
        // project is gone from the app's perspective even if the physical
        // cleanup below hits a transient OS file lock (e.g. a file written
        // moments ago still briefly held by an antivirus scan on Windows) -
        // that failure is logged but must not make the project reappear.
        db::delete(conn, &project_id)?;
        let dir = storage.project_dir(&project_id)?;
        if let Err(e) = remove_dir_all_if_exists(&dir) {
            crate::utils::logger::append(
                storage,
                &format!("Failed to remove project directory {}: {e}", dir.display()),
            );
        }
        crate::utils::logger::info(storage, &format!("Project deleted: {project_id}"));
        Ok(())
    })
}
