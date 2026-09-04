use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use crate::database::{files as files_db, projects as projects_db, versions as versions_db};
use crate::models::{FileEntry, FileVersion};
use crate::state::AppState;
use crate::storage::{
    copy_with_checksum, guess_mime_type, remove_dir_all_if_exists, sanitize_filename, StorageRoot,
};
use crate::utils::id::new_id;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadProgress {
    operation_id: String,
    bytes_written: u64,
    total_bytes: u64,
}

/// Streams `source` into a brand-new version directory, records it in the
/// database, and makes it current - the one path shared by "upload first
/// file", "upload new version" and "restore". Restoring always goes through
/// here too, so a restored version is always a fresh, independent physical
/// copy of the source content (spec sections 41-42), never a link.
#[allow(clippy::too_many_arguments)]
fn write_version(
    app: &AppHandle,
    conn: &Connection,
    storage: &StorageRoot,
    project_id: &str,
    file_id: &str,
    version_number: i64,
    source: &Path,
    original_filename: &str,
    description: Option<&str>,
    now: &str,
    operation_id: Option<&str>,
) -> AppResult<FileEntry> {
    let safe_name = sanitize_filename(original_filename);
    let version_dir = storage.version_dir(project_id, file_id, version_number)?;
    let final_path = version_dir.join(&safe_name);

    let op_id = operation_id.map(|s| s.to_string());
    let app_for_progress = app.clone();
    let copy_result = copy_with_checksum(
        source,
        &final_path,
        &storage.temp_dir(),
        move |written, total| {
            if let Some(id) = &op_id {
                let _ = app_for_progress.emit(
                    "upload-progress",
                    UploadProgress {
                        operation_id: id.clone(),
                        bytes_written: written,
                        total_bytes: total,
                    },
                );
            }
        },
    )?;

    let version_id = new_id();
    let relative = storage.relative_path(&final_path)?;
    let mime = guess_mime_type(original_filename);

    let db_result = (|| -> rusqlite::Result<()> {
        versions_db::create(
            conn,
            &version_id,
            file_id,
            version_number,
            &relative,
            original_filename,
            copy_result.size as i64,
            mime.as_deref(),
            &copy_result.checksum,
            description,
            now,
        )?;
        files_db::bump_next_version_number(conn, file_id)?;
        files_db::set_current_version(conn, file_id, Some(&version_id), now)?;
        Ok(())
    })();

    if let Err(e) = db_result {
        // The file made it to disk but the DB write failed - remove it so we
        // never end up with a version on disk that has no database record
        // (spec section 65).
        let _ = remove_dir_all_if_exists(&version_dir);
        return Err(AppError::from(e));
    }

    files_db::get(conn, file_id)?.ok_or_else(|| AppError::user("Failed to save the new version."))
}

#[tauri::command]
pub fn get_versions(state: State<AppState>, file_id: String) -> AppResult<Vec<FileVersion>> {
    with_ready(&state, |conn, _| Ok(versions_db::list_for_file(conn, &file_id)?))
}

#[tauri::command]
pub fn upload_file(
    app: AppHandle,
    state: State<AppState>,
    project_id: String,
    source_path: String,
    description: Option<String>,
    operation_id: Option<String>,
) -> AppResult<FileEntry> {
    let source = PathBuf::from(&source_path);
    let display_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();

    with_ready(&state, |conn, storage| {
        if !projects_db::exists(conn, &project_id)? {
            return Err(AppError::user("This project no longer exists."));
        }
        let file_id = new_id();
        let now = now_iso();
        files_db::create(conn, &file_id, &project_id, &display_name, &now)?;

        match write_version(
            &app,
            conn,
            storage,
            &project_id,
            &file_id,
            1,
            &source,
            &display_name,
            description.as_deref(),
            &now,
            operation_id.as_deref(),
        ) {
            Ok(entry) => Ok(entry),
            Err(e) => {
                let _ = files_db::delete(conn, &file_id);
                Err(e)
            }
        }
    })
}

#[tauri::command]
pub fn upload_new_version(
    app: AppHandle,
    state: State<AppState>,
    file_id: String,
    source_path: String,
    description: Option<String>,
    operation_id: Option<String>,
) -> AppResult<FileEntry> {
    let source = PathBuf::from(&source_path);
    let original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();

    with_ready(&state, |conn, storage| {
        let file = files_db::get(conn, &file_id)?
            .ok_or_else(|| AppError::user("This file no longer exists."))?;
        let version_number = files_db::next_version_number(conn, &file_id)?;
        let now = now_iso();
        write_version(
            &app,
            conn,
            storage,
            &file.project_id,
            &file_id,
            version_number,
            &source,
            &original_filename,
            description.as_deref(),
            &now,
            operation_id.as_deref(),
        )
    })
}

#[tauri::command]
pub fn restore_version(
    app: AppHandle,
    state: State<AppState>,
    file_id: String,
    version_id: String,
    description: Option<String>,
) -> AppResult<FileEntry> {
    with_ready(&state, |conn, storage| {
        let file = files_db::get(conn, &file_id)?
            .ok_or_else(|| AppError::user("This file no longer exists."))?;
        let source_version = versions_db::get(conn, &version_id)?
            .ok_or_else(|| AppError::user("This version no longer exists."))?;
        if source_version.file_id != file_id {
            return Err(AppError::user("That version does not belong to this file."));
        }
        let source_abs = storage.resolve_existing(&source_version.storage_path)?;
        let version_number = files_db::next_version_number(conn, &file_id)?;
        let now = now_iso();
        let desc = description.unwrap_or_else(|| {
            format!("Restored from version v{}", source_version.version_number)
        });

        write_version(
            &app,
            conn,
            storage,
            &file.project_id,
            &file_id,
            version_number,
            &source_abs,
            &source_version.original_filename,
            Some(&desc),
            &now,
            None,
        )
    })
}

#[tauri::command]
pub fn delete_version(state: State<AppState>, version_id: String) -> AppResult<Option<FileEntry>> {
    with_ready(&state, |conn, storage| {
        let version = versions_db::get(conn, &version_id)?
            .ok_or_else(|| AppError::user("This version no longer exists."))?;
        let file = files_db::get(conn, &version.file_id)?
            .ok_or_else(|| AppError::user("This file no longer exists."))?;
        let was_current = file.current_version_id.as_deref() == Some(version_id.as_str());

        versions_db::delete(conn, &version_id)?;
        let version_dir = storage.version_dir(&file.project_id, &file.id, version.version_number)?;
        remove_dir_all_if_exists(&version_dir)?;

        let remaining = versions_db::count_for_file(conn, &file.id)?;
        if remaining == 0 {
            // The only version was deleted - the logical file goes with it
            // (spec section 45).
            files_db::delete(conn, &file.id)?;
            let file_dir = storage.file_dir(&file.project_id, &file.id)?;
            remove_dir_all_if_exists(&file_dir)?;
            return Ok(None);
        }

        if was_current {
            // Promote the highest remaining version number - version
            // numbers themselves are never reassigned (spec sections 33/44).
            if let Some(next_current) = versions_db::highest_remaining(conn, &file.id)? {
                files_db::set_current_version(conn, &file.id, Some(&next_current.id), &now_iso())?;
            }
        }

        Ok(files_db::get(conn, &file.id)?)
    })
}

#[tauri::command]
pub fn download_version(
    state: State<AppState>,
    version_id: String,
    dest_path: String,
) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let version = versions_db::get(conn, &version_id)?
            .ok_or_else(|| AppError::user("This version no longer exists."))?;
        let source_abs = storage.resolve_existing(&version.storage_path)?;
        std::fs::copy(&source_abs, &dest_path)
            .map_err(|e| AppError::with_details("Unable to save the file.", e))?;
        Ok(())
    })
}

#[tauri::command]
pub fn open_version(app: AppHandle, state: State<AppState>, version_id: String) -> AppResult<()> {
    let path = with_ready(&state, |conn, storage| {
        let version = versions_db::get(conn, &version_id)?
            .ok_or_else(|| AppError::user("This version no longer exists."))?;
        storage.resolve_existing(&version.storage_path)
    })?;

    // Hands the path to the OS default application only - the app never
    // executes uploaded files itself (spec section 83).
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::with_details("Unable to open the file.", e))
}
