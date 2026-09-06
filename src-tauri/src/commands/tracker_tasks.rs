use std::path::PathBuf;

use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::database::{
    files as files_db, tracker_boards as boards_db, tracker_events, tracker_field_values as field_values_db,
    tracker_labels as labels_db, tracker_priorities as priorities_db, tracker_statuses as statuses_db,
    tracker_task_files as task_files_db, tracker_task_local_files as local_files_db, tracker_tasks as tasks_db,
};
use crate::models::{
    DuplicateOptions, FieldValue, NewTaskFile, Task, TaskDetail, TaskEvent, TaskFilter, TaskInput,
    TaskUpdateInput,
};
use crate::state::AppState;
use crate::storage::{copy_with_checksum, guess_mime_type, remove_dir_all_if_exists, sanitize_filename};
use crate::utils::id::new_id;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

// ---- Listing ------------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_tasks(state: State<AppState>, board_id: String, include_archived: Option<bool>) -> AppResult<Vec<Task>> {
    with_ready(&state, |conn, _| {
        task_files_db::sync_always_latest_all(conn, &now_iso())?;
        Ok(tasks_db::list_for_board(conn, &board_id, include_archived.unwrap_or(false))?)
    })
}

#[tauri::command]
pub fn get_all_tracker_tasks(state: State<AppState>, filter: TaskFilter) -> AppResult<Vec<Task>> {
    with_ready(&state, |conn, _| {
        task_files_db::sync_always_latest_all(conn, &now_iso())?;
        Ok(tasks_db::list_all(conn, &filter)?)
    })
}

#[tauri::command]
pub fn get_project_tracker_tasks(state: State<AppState>, project_id: String) -> AppResult<Vec<Task>> {
    with_ready(&state, |conn, _| {
        task_files_db::sync_always_latest_all(conn, &now_iso())?;
        Ok(tasks_db::list_for_project(conn, &project_id, false)?)
    })
}

#[tauri::command]
pub fn get_file_tracker_tasks(state: State<AppState>, file_id: String) -> AppResult<Vec<Task>> {
    with_ready(&state, |conn, _| {
        task_files_db::sync_always_latest_all(conn, &now_iso())?;
        Ok(tasks_db::list_for_file(conn, &file_id)?)
    })
}

#[tauri::command]
pub fn get_tracker_task(state: State<AppState>, task_id: String) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        tasks_db::get_detail(conn, &task_id, &now_iso())?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

// ---- Create / update ------------------------------------------------------------

fn resolve_status_for_new_task(conn: &rusqlite::Connection, board_id: &str, status_id: &Option<String>) -> AppResult<String> {
    match status_id {
        Some(s) => {
            let status = statuses_db::get(conn, s)?.ok_or_else(|| AppError::user("This status no longer exists."))?;
            if status.board_id != board_id {
                return Err(AppError::user("That status doesn't belong to this board."));
            }
            Ok(status.id)
        }
        None => statuses_db::default_or_first(conn, board_id)?
            .map(|s| s.id)
            .ok_or_else(|| AppError::user("This board has no statuses.")),
    }
}

fn resolve_priority_for_new_task(conn: &rusqlite::Connection, board_id: &str, priority_id: &Option<String>) -> AppResult<String> {
    match priority_id {
        Some(p) => {
            let priority = priorities_db::get(conn, p)?.ok_or_else(|| AppError::user("This priority no longer exists."))?;
            if priority.board_id != board_id {
                return Err(AppError::user("That priority doesn't belong to this board."));
            }
            Ok(priority.id)
        }
        None => priorities_db::default_or_first(conn, board_id)?
            .map(|p| p.id)
            .ok_or_else(|| AppError::user("This board has no priorities.")),
    }
}

/// Attaches one file to a task at creation or afterwards: resolves the
/// file's live name/current version from the file manager's own tables
/// (never duplicated onto the task) and logs a `file_added` history entry.
fn attach_file(conn: &rusqlite::Connection, task_id: &str, nf: &NewTaskFile, now: &str) -> AppResult<()> {
    let file = files_db::get(conn, &nf.file_id)?.ok_or_else(|| AppError::user("This file no longer exists."))?;
    let current_version_id = file
        .current_version_id
        .clone()
        .ok_or_else(|| AppError::user("This file has no versions yet."))?;

    let fixed_version_id = if nf.always_latest {
        None
    } else {
        Some(nf.version_id.clone().unwrap_or_else(|| current_version_id.clone()))
    };

    let version_number_for_log = match fixed_version_id.as_deref() {
        Some(v) => versions_number_of(conn, v)?,
        None => None,
    };

    let id = new_id();
    task_files_db::attach(
        conn,
        &id,
        task_id,
        &nf.file_id,
        fixed_version_id.as_deref(),
        nf.always_latest,
        Some(&current_version_id),
        &file.name,
        now,
    )?;

    tracker_events::log(
        conn,
        task_id,
        "file_added",
        &FileAddedPayload { file_name: &file.name, version_number: version_number_for_log, always_latest: nf.always_latest },
        None,
        now,
    )?;
    Ok(())
}

fn versions_number_of(conn: &rusqlite::Connection, version_id: &str) -> AppResult<Option<i64>> {
    Ok(conn
        .query_row(
            "SELECT version_number FROM file_versions WHERE id = ?1",
            rusqlite::params![version_id],
            |r| r.get(0),
        )
        .optional()?)
}

#[derive(Serialize)]
struct FileAddedPayload<'a> {
    file_name: &'a str,
    version_number: Option<i64>,
    always_latest: bool,
}

#[derive(Serialize)]
struct FileRemovedPayload<'a> {
    file_name: &'a str,
}

#[tauri::command]
pub fn create_tracker_task(state: State<AppState>, input: TaskInput) -> AppResult<TaskDetail> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::user("Task title cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        if !boards_db::exists(conn, &input.board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        let status_id = resolve_status_for_new_task(conn, &input.board_id, &input.status_id)?;
        let priority_id = resolve_priority_for_new_task(conn, &input.board_id, &input.priority_id)?;

        let id = new_id();
        let now = now_iso();
        let received_at = input.received_at.clone().unwrap_or_else(|| now.clone());

        tasks_db::create(
            conn, &id, &input.board_id, &status_id, &title, input.description.as_deref(),
            input.project_id.as_deref(), input.customer.as_deref(), input.assignee.as_deref(), &priority_id,
            &received_at, input.due_at.as_deref(), &now,
        )?;

        if let Some(label_ids) = &input.label_ids {
            labels_db::set_for_task(conn, &id, label_ids)?;
        }
        if let Some(values) = &input.field_values {
            field_values_db::set_for_task(conn, &id, values)?;
        }

        tracker_events::log(conn, &id, "created", &serde_json::Value::Null, None, &now)?;

        if let Some(files) = &input.files {
            for nf in files {
                attach_file(conn, &id, nf, &now)?;
            }
        }

        crate::utils::logger::info(storage, &format!("Tracker task created: \"{title}\" ({id})"));
        tasks_db::get_detail(conn, &id, &now)?.ok_or_else(|| AppError::user("Failed to create task."))
    })
}

#[derive(Serialize)]
struct ChangePayload<T: Serialize> {
    from: T,
    to: T,
}

#[tauri::command]
pub fn update_tracker_task(state: State<AppState>, task_id: String, patch: TaskUpdateInput) -> AppResult<TaskDetail> {
    if let Some(title) = &patch.title {
        if title.trim().is_empty() {
            return Err(AppError::user("Task title cannot be empty."));
        }
    }
    with_ready(&state, |conn, _| {
        let now = now_iso();
        let (old, merged) = tasks_db::apply_update(conn, &task_id, &patch, &now)?
            .ok_or_else(|| AppError::user("This task no longer exists."))?;

        if old.title != merged.title {
            tracker_events::log(conn, &task_id, "title_changed", &ChangePayload { from: &old.title, to: &merged.title }, None, &now)?;
        }
        if old.priority_id != merged.priority_id {
            let from_name = priorities_db::get(conn, &old.priority_id)?.map(|p| p.name);
            let to_name = priorities_db::get(conn, &merged.priority_id)?.map(|p| p.name);
            tracker_events::log(conn, &task_id, "priority_changed", &ChangePayload { from: from_name, to: to_name }, None, &now)?;
        }
        if old.due_at != merged.due_at {
            tracker_events::log(conn, &task_id, "due_changed", &ChangePayload { from: &old.due_at, to: &merged.due_at }, None, &now)?;
        }
        if old.assignee != merged.assignee {
            tracker_events::log(conn, &task_id, "assignee_changed", &ChangePayload { from: &old.assignee, to: &merged.assignee }, None, &now)?;
        }
        if old.customer != merged.customer {
            tracker_events::log(conn, &task_id, "customer_changed", &ChangePayload { from: &old.customer, to: &merged.customer }, None, &now)?;
        }
        if old.project_id != merged.project_id {
            let from_name = old.project_id.as_deref().and_then(|id| crate::database::projects::get(conn, id).ok().flatten()).map(|p| p.name);
            let to_name = merged.project_id.as_deref().and_then(|id| crate::database::projects::get(conn, id).ok().flatten()).map(|p| p.name);
            tracker_events::log(conn, &task_id, "project_changed", &ChangePayload { from: from_name, to: to_name }, None, &now)?;
        }
        if old.completed_at != merged.completed_at {
            tracker_events::log(conn, &task_id, "completed_at_changed", &ChangePayload { from: &old.completed_at, to: &merged.completed_at }, None, &now)?;
        }

        tasks_db::get_detail(conn, &task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn set_tracker_task_field_values(state: State<AppState>, task_id: String, values: Vec<FieldValue>) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        let now = now_iso();
        field_values_db::set_for_task(conn, &task_id, &values)?;
        conn.execute("UPDATE tracker_tasks SET updated_at = ?2 WHERE id = ?1", rusqlite::params![task_id, now])?;
        tasks_db::get_detail(conn, &task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn set_tracker_task_labels(state: State<AppState>, task_id: String, label_ids: Vec<String>) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        let now = now_iso();
        labels_db::set_for_task(conn, &task_id, &label_ids)?;
        conn.execute("UPDATE tracker_tasks SET updated_at = ?2 WHERE id = ?1", rusqlite::params![task_id, now])?;
        tasks_db::get_detail(conn, &task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

// ---- Status / position (drag & drop) ---------------------------------------------

#[derive(Serialize)]
struct StatusChangedPayload<'a> {
    from_status: &'a str,
    to_status: &'a str,
}

/// Backs both a cross-column drag (status changes) and a same-column
/// reorder (status is unchanged) - `ordered_ids` is always the destination
/// column's full new order, moved task included, exactly like
/// `reorder_files` takes the whole list rather than a single index.
#[tauri::command]
pub fn move_tracker_task(state: State<AppState>, task_id: String, status_id: String, ordered_ids: Vec<String>) -> AppResult<Task> {
    with_ready(&state, |conn, storage| {
        let task = tasks_db::get(conn, &task_id)?.ok_or_else(|| AppError::user("This task no longer exists."))?;
        let new_status = statuses_db::get(conn, &status_id)?.ok_or_else(|| AppError::user("This status no longer exists."))?;
        let now = now_iso();

        if task.status_id != status_id {
            let old_status = statuses_db::get(conn, &task.status_id)?;
            tasks_db::set_status(conn, &task_id, &status_id, &now)?;
            tracker_events::log(
                conn, &task_id, "status_changed",
                &StatusChangedPayload {
                    from_status: old_status.as_ref().map(|s| s.name.as_str()).unwrap_or(""),
                    to_status: &new_status.name,
                },
                None, &now,
            )?;
            // Entering a "done" status sets the completion date automatically,
            // once - leaving it later never clears that date back out (spec
            // section 10/18). A manual override still goes through
            // update_tracker_task's completed_at field afterwards.
            if new_status.is_done && task.completed_at.is_none() {
                tasks_db::set_completed_at(conn, &task_id, Some(&now), &now)?;
                tracker_events::log(conn, &task_id, "completed_at_changed", &ChangePayload { from: None::<String>, to: Some(now.clone()) }, None, &now)?;
            }
        }

        for (i, id) in ordered_ids.iter().enumerate() {
            tasks_db::set_position(conn, id, i as i64)?;
        }

        crate::utils::logger::info(storage, &format!("Tracker task moved: {task_id} -> status {status_id}"));
        tasks_db::get(conn, &task_id)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn set_tracker_task_pinned(state: State<AppState>, task_id: String, pinned: bool) -> AppResult<Task> {
    with_ready(&state, |conn, _| {
        let now = now_iso();
        tasks_db::set_pinned(conn, &task_id, pinned, &now)?;
        tracker_events::log(conn, &task_id, if pinned { "pinned" } else { "unpinned" }, &serde_json::Value::Null, None, &now)?;
        tasks_db::get(conn, &task_id)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn set_tracker_task_archived(state: State<AppState>, task_id: String, archived: bool) -> AppResult<Task> {
    with_ready(&state, |conn, storage| {
        let now = now_iso();
        tasks_db::set_archived(conn, &task_id, archived, &now)?;
        tracker_events::log(conn, &task_id, if archived { "archived" } else { "unarchived" }, &serde_json::Value::Null, None, &now)?;
        crate::utils::logger::info(storage, &format!("Tracker task {} : {task_id}", if archived { "archived" } else { "restored from archive" }));
        tasks_db::get(conn, &task_id)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn delete_tracker_task(state: State<AppState>, task_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if tasks_db::get(conn, &task_id)?.is_none() {
            return Err(AppError::user("This task no longer exists."));
        }
        // Only the tracker's own rows go away here (task, its file links,
        // labels, field values, history) - never anything in `files` /
        // `file_versions` / `projects` (spec section 28). Local ("from the
        // computer") attachments are the one exception: their bytes exist
        // only for this task, so they're removed from disk too.
        if let Ok(dir) = storage.task_attachment_dir(&task_id) {
            let _ = remove_dir_all_if_exists(&dir);
        }
        tasks_db::delete(conn, &task_id)?;
        crate::utils::logger::info(storage, &format!("Tracker task deleted: {task_id}"));
        Ok(())
    })
}

// ---- Duplicate ------------------------------------------------------------------

#[tauri::command]
pub fn duplicate_tracker_task(state: State<AppState>, task_id: String, options: DuplicateOptions) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, storage| {
        let source = tasks_db::get(conn, &task_id)?.ok_or_else(|| AppError::user("This task no longer exists."))?;
        let now = now_iso();
        let new_id_str = new_id();
        let new_title = format!("Copy of {}", source.title);
        let priority_id = if options.priority {
            source.priority_id.clone()
        } else {
            priorities_db::default_or_first(conn, &source.board_id)?
                .map(|p| p.id)
                .unwrap_or_else(|| source.priority_id.clone())
        };

        tasks_db::create(
            conn, &new_id_str, &source.board_id, &source.status_id, &new_title,
            if options.description { source.description.as_deref() } else { None },
            source.project_id.as_deref(), source.customer.as_deref(),
            if options.assignee { source.assignee.as_deref() } else { None },
            &priority_id,
            &now,
            if options.due_at { source.due_at.as_deref() } else { None },
            &now,
        )?;

        if options.field_values {
            let values = field_values_db::list_for_task(conn, &task_id)?;
            field_values_db::set_for_task(conn, &new_id_str, &values)?;
        }
        labels_db::set_for_task(conn, &new_id_str, &source.label_ids)?;

        tracker_events::log(
            conn, &new_id_str, "duplicated",
            &DuplicatedPayload { source_title: &source.title },
            None, &now,
        )?;

        if options.files {
            for f in task_files_db::list_for_task(conn, &task_id)? {
                if !f.file_exists {
                    continue;
                }
                let nf = NewTaskFile { file_id: f.file_id, version_id: f.version_id, always_latest: f.always_latest };
                attach_file(conn, &new_id_str, &nf, &now)?;
            }
            for lf in local_files_db::list_for_task(conn, &task_id)? {
                let Some(full) = local_files_db::get(conn, &lf.id)? else { continue };
                let Ok(src_abs) = storage.resolve_existing(&full.storage_path) else { continue };
                let Ok(dir) = storage.task_attachment_dir(&new_id_str) else { continue };
                let new_lf_id = new_id();
                let dest = dir.join(format!("{new_lf_id}_{}", sanitize_filename(&lf.file_name)));
                if let Some(parent) = dest.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if std::fs::copy(&src_abs, &dest).is_ok() {
                    if let Ok(relative) = storage.relative_path(&dest) {
                        local_files_db::create(conn, &new_lf_id, &new_id_str, &lf.file_name, &relative, lf.file_size, lf.mime_type.as_deref(), &now)?;
                    }
                }
            }
        }

        crate::utils::logger::info(storage, &format!("Tracker task duplicated: {task_id} -> {new_id_str}"));
        tasks_db::get_detail(conn, &new_id_str, &now)?.ok_or_else(|| AppError::user("Failed to duplicate task."))
    })
}

#[derive(Serialize)]
struct DuplicatedPayload<'a> {
    source_title: &'a str,
}

// ---- Files ------------------------------------------------------------------------

#[tauri::command]
pub fn attach_tracker_task_file(state: State<AppState>, task_id: String, file: NewTaskFile) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        if tasks_db::get(conn, &task_id)?.is_none() {
            return Err(AppError::user("This task no longer exists."));
        }
        let now = now_iso();
        attach_file(conn, &task_id, &file, &now)?;
        tasks_db::get_detail(conn, &task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

/// Removes the task's link to a file - the file, and every version of it,
/// stay exactly where they are in the file manager (spec section 6/38).
#[tauri::command]
pub fn detach_tracker_task_file(state: State<AppState>, task_file_id: String) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        let link = task_files_db::get(conn, &task_file_id)?
            .ok_or_else(|| AppError::user("This attachment no longer exists."))?;
        let now = now_iso();
        task_files_db::detach(conn, &task_file_id)?;
        tracker_events::log(conn, &link.task_id, "file_removed", &FileRemovedPayload { file_name: &link.file_name }, None, &now)?;
        tasks_db::get_detail(conn, &link.task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[derive(Serialize)]
struct FilePinChangedPayload<'a> {
    file_name: &'a str,
    always_latest: bool,
}

/// Flips one attachment between "always latest" and "pinned to a fixed
/// version" after the fact - the picker only sets this at attach time
/// otherwise.
#[tauri::command]
pub fn set_tracker_task_file_pin(state: State<AppState>, task_file_id: String, always_latest: bool) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, _| {
        let link = task_files_db::get(conn, &task_file_id)?
            .ok_or_else(|| AppError::user("This attachment no longer exists."))?;
        let now = now_iso();
        if always_latest {
            let file = files_db::get(conn, &link.file_id)?.ok_or_else(|| AppError::user("This file no longer exists."))?;
            task_files_db::set_always_latest(conn, &task_file_id, true, file.current_version_id.as_deref())?;
        } else {
            let pin_to = link.version_id.clone().ok_or_else(|| AppError::user("This file has no version to pin to."))?;
            task_files_db::set_always_latest(conn, &task_file_id, false, None)?;
            task_files_db::set_pinned_version(conn, &task_file_id, &pin_to)?;
        }
        tracker_events::log(conn, &link.task_id, "file_pin_changed", &FilePinChangedPayload { file_name: &link.file_name, always_latest }, None, &now)?;
        tasks_db::get_detail(conn, &link.task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

// ---- Local files (attached "from the computer", never versioned) --------------

#[derive(Serialize)]
struct LocalFileAddedPayload<'a> {
    file_name: &'a str,
}

#[derive(Serialize)]
struct LocalFileRemovedPayload<'a> {
    file_name: &'a str,
}

#[tauri::command]
pub fn add_tracker_task_local_file(state: State<AppState>, task_id: String, source_path: String) -> AppResult<TaskDetail> {
    let source = PathBuf::from(&source_path);
    let display_name = source.file_name().and_then(|n| n.to_str()).unwrap_or("Untitled").to_string();
    with_ready(&state, |conn, storage| {
        if tasks_db::get(conn, &task_id)?.is_none() {
            return Err(AppError::user("This task no longer exists."));
        }
        let id = new_id();
        let now = now_iso();
        let dir = storage.task_attachment_dir(&task_id)?;
        let final_path = dir.join(format!("{id}_{}", sanitize_filename(&display_name)));
        let copy_result = copy_with_checksum(&source, &final_path, &storage.temp_dir(), |_, _| {})?;
        let relative = storage.relative_path(&final_path)?;
        let mime = guess_mime_type(&display_name);
        local_files_db::create(conn, &id, &task_id, &display_name, &relative, copy_result.size as i64, mime.as_deref(), &now)?;
        tracker_events::log(conn, &task_id, "local_file_added", &LocalFileAddedPayload { file_name: &display_name }, None, &now)?;
        tasks_db::get_detail(conn, &task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn remove_tracker_task_local_file(state: State<AppState>, local_file_id: String) -> AppResult<TaskDetail> {
    with_ready(&state, |conn, storage| {
        let lf = local_files_db::get(conn, &local_file_id)?
            .ok_or_else(|| AppError::user("This attachment no longer exists."))?;
        let now = now_iso();
        local_files_db::delete(conn, &local_file_id)?;
        if let Ok(abs) = storage.resolve_existing(&lf.storage_path) {
            let _ = std::fs::remove_file(abs);
        }
        tracker_events::log(conn, &lf.file.task_id, "local_file_removed", &LocalFileRemovedPayload { file_name: &lf.file.file_name }, None, &now)?;
        tasks_db::get_detail(conn, &lf.file.task_id, &now)?.ok_or_else(|| AppError::user("This task no longer exists."))
    })
}

#[tauri::command]
pub fn open_tracker_task_local_file(app: AppHandle, state: State<AppState>, local_file_id: String) -> AppResult<()> {
    let path = with_ready(&state, |conn, storage| {
        let lf = local_files_db::get(conn, &local_file_id)?
            .ok_or_else(|| AppError::user("This attachment no longer exists."))?;
        storage.resolve_existing(&lf.storage_path)
    })?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::with_details("Unable to open the file.", e))
}

// ---- Comments -----------------------------------------------------------------

#[derive(Serialize)]
struct CommentPayload<'a> {
    text: &'a str,
}

#[tauri::command]
pub fn add_tracker_task_comment(state: State<AppState>, task_id: String, text: String) -> AppResult<TaskEvent> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err(AppError::user("Comment cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if tasks_db::get(conn, &task_id)?.is_none() {
            return Err(AppError::user("This task no longer exists."));
        }
        let now = now_iso();
        tracker_events::log(conn, &task_id, "comment", &CommentPayload { text: &text }, None, &now)?;
        tracker_events::list_for_task(conn, &task_id)?
            .into_iter()
            .last()
            .ok_or_else(|| AppError::user("Failed to add comment."))
    })
}
