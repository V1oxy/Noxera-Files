use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use crate::database::{files as files_db, projects as projects_db, versions as versions_db};
use crate::models::{FileEntry, FileVersion};
use crate::state::AppState;
use crate::storage::{
    copy_with_checksum, guess_mime_type, remove_dir_all_if_exists, rename_dir_with_retry,
    sanitize_filename, StorageRoot,
};
use crate::utils::id::new_id;
use crate::utils::logger;
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
    folder_id: Option<String>,
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
        files_db::create(conn, &file_id, &project_id, folder_id.as_deref(), &display_name, &now)?;

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
            Ok(entry) => {
                logger::info(storage, &format!("File uploaded: \"{display_name}\" ({file_id}) in project {project_id}"));
                Ok(entry)
            }
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
        let entry = write_version(
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
        )?;
        logger::info(storage, &format!("New version v{version_number} uploaded for file {file_id}"));
        Ok(entry)
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

        let entry = write_version(
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
        )?;
        logger::info(
            storage,
            &format!("Version v{} restored as v{version_number} for file {file_id}", source_version.version_number),
        );
        Ok(entry)
    })
}

#[tauri::command]
pub fn update_version_description(
    state: State<AppState>,
    version_id: String,
    description: Option<String>,
) -> AppResult<FileVersion> {
    let trimmed = description.as_deref().map(str::trim).filter(|s| !s.is_empty());
    with_ready(&state, |conn, storage| {
        let existing = versions_db::get(conn, &version_id)?
            .ok_or_else(|| AppError::user("This version no longer exists."))?;
        versions_db::update_description(conn, &version_id, trimmed)?;
        logger::info(
            storage,
            &format!("Description updated for version v{} ({version_id})", existing.version_number),
        );
        versions_db::get(conn, &version_id)?.ok_or_else(|| AppError::user("This version no longer exists."))
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
        if let Err(e) = remove_dir_all_if_exists(&version_dir) {
            logger::append(
                storage,
                &format!("Failed to remove version directory {}: {e}", version_dir.display()),
            );
        }
        logger::info(
            storage,
            &format!("Version v{} deleted for file {}", version.version_number, file.id),
        );

        let remaining = versions_db::count_for_file(conn, &file.id)?;
        if remaining == 0 {
            // The only version was deleted - the logical file goes with it
            // (spec section 45).
            files_db::delete(conn, &file.id)?;
            let file_dir = storage.file_dir(&file.project_id, &file.id)?;
            if let Err(e) = remove_dir_all_if_exists(&file_dir) {
                logger::append(
                    storage,
                    &format!("Failed to remove file directory {}: {e}", file_dir.display()),
                );
            }
            logger::info(storage, &format!("File {} deleted (last version removed)", file.id));
            return Ok(None);
        }

        renumber_after_delete(storage, conn, &file, version.version_number)?;

        if was_current {
            // The version that used to have the highest number is now the
            // new current one, whatever number it landed on after the shift.
            if let Some(next_current) = versions_db::highest_remaining(conn, &file.id)? {
                files_db::set_current_version(conn, &file.id, Some(&next_current.id), &now_iso())?;
            }
        }

        Ok(files_db::get(conn, &file.id)?)
    })
}

/// Keeps version numbers (and their on-disk `v{N}/` directories) contiguous
/// after a deletion: every version that was numbered above the deleted one
/// shifts down by one, in ascending order so each target directory name is
/// always vacated (by the deletion itself, or by the previous shift) before
/// it's needed. The version's id, description, checksum and every other
/// column stay untouched - only its number and storage path move.
fn renumber_after_delete(
    storage: &StorageRoot,
    conn: &Connection,
    file: &FileEntry,
    deleted_number: i64,
) -> AppResult<()> {
    let to_shift = versions_db::versions_after(conn, &file.id, deleted_number)?;
    if to_shift.is_empty() {
        return Ok(());
    }

    // Physically rename every affected version directory first. If one
    // fails partway through, undo the renames already done so disk and
    // database never disagree about where a version's file lives.
    let mut done: Vec<(std::path::PathBuf, std::path::PathBuf)> = Vec::new();
    for v in &to_shift {
        let old_dir = storage.version_dir(&file.project_id, &file.id, v.version_number)?;
        let new_dir = storage.version_dir(&file.project_id, &file.id, v.version_number - 1)?;
        if let Err(e) = rename_dir_with_retry(&old_dir, &new_dir) {
            for (from, to) in done.iter().rev() {
                let _ = rename_dir_with_retry(to, from);
            }
            return Err(AppError::with_details(
                "Unable to renumber the remaining versions on disk.",
                e,
            ));
        }
        done.push((old_dir, new_dir));
    }

    let result = (|| -> rusqlite::Result<()> {
        conn.execute_batch("BEGIN")?;
        for v in &to_shift {
            let new_number = v.version_number - 1;
            let new_dir = storage
                .version_dir(&file.project_id, &file.id, new_number)
                .map_err(|_| rusqlite::Error::InvalidQuery)?;
            let new_relative = storage
                .relative_path(&new_dir.join(&v.original_filename))
                .map_err(|_| rusqlite::Error::InvalidQuery)?;
            versions_db::renumber(conn, &v.id, new_number, &new_relative)?;
        }
        files_db::decrement_next_version_number(conn, &file.id)?;
        conn.execute_batch("COMMIT")?;
        Ok(())
    })();

    if let Err(e) = result {
        let _ = conn.execute_batch("ROLLBACK");
        // The DB update failed after the directories were already renamed -
        // put them back so disk state matches the (unchanged) DB rows.
        for (from, to) in done.iter().rev() {
            let _ = rename_dir_with_retry(to, from);
        }
        return Err(AppError::from(e));
    }

    logger::info(
        storage,
        &format!(
            "Renumbered {} version(s) for file {} after deleting v{deleted_number}",
            to_shift.len(),
            file.id
        ),
    );
    Ok(())
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
