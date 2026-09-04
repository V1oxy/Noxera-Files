use tauri::State;

use crate::database::{files as files_db, versions as versions_db};
use crate::models::{FileDetail, FileEntry, SortDirection, SortField};
use crate::state::AppState;
use crate::storage::remove_dir_all_if_exists;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

#[tauri::command]
pub fn get_files(
    state: State<AppState>,
    project_id: String,
    folder_id: Option<String>,
    search: Option<String>,
    sort_field: Option<SortField>,
    sort_dir: Option<SortDirection>,
) -> AppResult<Vec<FileEntry>> {
    // Default sort: Last Modified, newest first (spec section 50).
    let field = sort_field.unwrap_or(SortField::LastModified);
    let dir = sort_dir.unwrap_or(SortDirection::Desc);
    with_ready(&state, |conn, _| {
        Ok(files_db::list_for_project(
            conn,
            &project_id,
            folder_id.as_deref(),
            search.as_deref(),
            field,
            dir,
        )?)
    })
}

#[tauri::command]
pub fn get_file(state: State<AppState>, file_id: String) -> AppResult<FileDetail> {
    with_ready(&state, |conn, _| {
        let file = files_db::get(conn, &file_id)?
            .ok_or_else(|| AppError::user("This file no longer exists."))?;
        let versions = versions_db::list_for_file(conn, &file_id)?;
        Ok(FileDetail { file, versions })
    })
}

#[tauri::command]
pub fn rename_file(
    state: State<AppState>,
    file_id: String,
    new_name: String,
) -> AppResult<FileEntry> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::user("File name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let now = now_iso();
        let updated = files_db::rename(conn, &file_id, &new_name, &now)?;
        if updated == 0 {
            return Err(AppError::user("This file no longer exists."));
        }
        files_db::get(conn, &file_id)?.ok_or_else(|| AppError::user("Failed to rename file."))
    })
}

#[tauri::command]
pub fn delete_file(state: State<AppState>, file_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let file = files_db::get(conn, &file_id)?
            .ok_or_else(|| AppError::user("This file no longer exists."))?;
        files_db::delete(conn, &file_id)?;
        let dir = storage.file_dir(&file.project_id, &file_id)?;
        if let Err(e) = remove_dir_all_if_exists(&dir) {
            crate::utils::logger::append(
                storage,
                &format!("Failed to remove file directory {}: {e}", dir.display()),
            );
        }
        Ok(())
    })
}
