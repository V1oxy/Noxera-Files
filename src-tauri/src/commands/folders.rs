use tauri::State;

use crate::database::{files as files_db, folders as db, projects as projects_db};
use crate::models::{Folder, FolderPathEntry};
use crate::state::AppState;
use crate::storage::remove_dir_all_if_exists;
use crate::utils::{now_iso, id::new_id, AppError, AppResult};

use super::with_ready;

#[tauri::command]
pub fn get_folders(
    state: State<AppState>,
    project_id: String,
    parent_folder_id: Option<String>,
) -> AppResult<Vec<Folder>> {
    with_ready(&state, |conn, _| {
        Ok(db::list_children(conn, &project_id, parent_folder_id.as_deref())?)
    })
}

#[tauri::command]
pub fn get_folder_path(state: State<AppState>, folder_id: String) -> AppResult<Vec<FolderPathEntry>> {
    with_ready(&state, |conn, _| Ok(db::path(conn, &folder_id)?))
}

#[tauri::command]
pub fn create_folder(
    state: State<AppState>,
    project_id: String,
    parent_folder_id: Option<String>,
    name: String,
) -> AppResult<Folder> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Folder name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !projects_db::exists(conn, &project_id)? {
            return Err(AppError::user("This project no longer exists."));
        }
        if let Some(parent) = &parent_folder_id {
            if db::get(conn, parent)?.is_none() {
                return Err(AppError::user("The parent folder no longer exists."));
            }
        }
        let id = new_id();
        let now = now_iso();
        db::create(conn, &id, &project_id, parent_folder_id.as_deref(), &name, &now)?;
        db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create folder."))
    })
}

#[tauri::command]
pub fn rename_folder(state: State<AppState>, folder_id: String, new_name: String) -> AppResult<Folder> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::user("Folder name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = db::rename(conn, &folder_id, &new_name, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This folder no longer exists."));
        }
        db::get(conn, &folder_id)?.ok_or_else(|| AppError::user("Failed to rename folder."))
    })
}

#[tauri::command]
pub fn delete_folder(state: State<AppState>, folder_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let folder = db::get(conn, &folder_id)?
            .ok_or_else(|| AppError::user("This folder no longer exists."))?;

        // Collect this folder plus every descendant folder (BFS) so we can
        // physically clean up every file they contain before the DB cascade
        // removes the rows - the cascade alone can't touch the filesystem.
        let mut all_folder_ids = vec![folder.id.clone()];
        let mut frontier = vec![folder.id.clone()];
        while let Some(fid) = frontier.pop() {
            for child in db::subfolder_ids(conn, &fid)? {
                all_folder_ids.push(child.clone());
                frontier.push(child);
            }
        }

        for fid in &all_folder_ids {
            for file_id in db::file_ids_in(conn, fid)? {
                if let Some(file) = files_db::get(conn, &file_id)? {
                    let dir = storage.file_dir(&file.project_id, &file.id)?;
                    if let Err(e) = remove_dir_all_if_exists(&dir) {
                        crate::utils::logger::append(
                            storage,
                            &format!("Failed to remove file directory {}: {e}", dir.display()),
                        );
                    }
                }
            }
        }

        // Deleting the top folder cascades (ON DELETE CASCADE) to every
        // subfolder and every file/version row within them.
        db::delete(conn, &folder.id)?;
        Ok(())
    })
}
