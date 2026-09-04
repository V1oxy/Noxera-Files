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
    with_ready(&state, |conn, storage| {
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
        crate::utils::logger::info(storage, &format!("Folder created: \"{name}\" ({id}) in project {project_id}"));
        db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create folder."))
    })
}

#[tauri::command]
pub fn rename_folder(state: State<AppState>, folder_id: String, new_name: String) -> AppResult<Folder> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::user("Folder name cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        let updated = db::rename(conn, &folder_id, &new_name, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This folder no longer exists."));
        }
        crate::utils::logger::info(storage, &format!("Folder renamed to \"{new_name}\" ({folder_id})"));
        db::get(conn, &folder_id)?.ok_or_else(|| AppError::user("Failed to rename folder."))
    })
}

/// Persists a new manual order for one folder's siblings (all children of
/// the same parent): `ordered_ids[i]` gets position `i`.
#[tauri::command]
pub fn reorder_folders(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        for (i, id) in ordered_ids.iter().enumerate() {
            db::set_position(conn, id, i as i64)?;
        }
        crate::utils::logger::info(storage, &format!("Folders reordered ({} items)", ordered_ids.len()));
        Ok(())
    })
}

/// Moves a folder under a different parent (None = the project's root) via
/// drag-and-drop, rejecting a move into itself or into one of its own
/// descendants (which would otherwise silently corrupt the tree into a
/// cycle a normal breadcrumb navigation could never escape).
#[tauri::command]
pub fn move_folder(state: State<AppState>, folder_id: String, parent_folder_id: Option<String>) -> AppResult<Folder> {
    with_ready(&state, |conn, storage| {
        let folder = db::get(conn, &folder_id)?
            .ok_or_else(|| AppError::user("This folder no longer exists."))?;

        if let Some(target) = &parent_folder_id {
            if *target == folder_id {
                return Err(AppError::user("A folder can't be moved into itself."));
            }
            if db::get(conn, target)?.is_none() {
                return Err(AppError::user("The target folder no longer exists."));
            }
            // path() returns target's own ancestor chain, root-to-target
            // inclusive - if folder_id shows up in it, target lives inside
            // folder_id's own subtree.
            if db::path(conn, target)?.iter().any(|e| e.id == folder_id) {
                return Err(AppError::user("A folder can't be moved into one of its own subfolders."));
            }
        }

        if folder.parent_folder_id == parent_folder_id {
            return Ok(folder);
        }

        let position = db::next_position(conn, &folder.project_id, parent_folder_id.as_deref())?;
        db::set_parent(conn, &folder_id, parent_folder_id.as_deref(), position, &now_iso())?;
        crate::utils::logger::info(storage, &format!("Folder moved: \"{}\" ({folder_id})", folder.name));
        db::get(conn, &folder_id)?.ok_or_else(|| AppError::user("Failed to move the folder."))
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
        crate::utils::logger::info(storage, &format!("Folder deleted: \"{}\" ({})", folder.name, folder.id));
        Ok(())
    })
}
