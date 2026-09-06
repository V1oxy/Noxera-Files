use tauri::State;

use crate::database::{
    tracker_boards as boards_db, tracker_fields as fields_db, tracker_labels as labels_db,
    tracker_priorities as priorities_db, tracker_statuses as statuses_db,
};
use crate::models::{
    Board, BoardInput, Field, FieldInput, Label, LabelInput, Priority, PriorityInput, Status, StatusInput,
};
use crate::state::AppState;
use crate::utils::id::new_id;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

// ---- Boards ---------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_boards(state: State<AppState>) -> AppResult<Vec<Board>> {
    with_ready(&state, |conn, _| Ok(boards_db::list(conn)?))
}

/// The starter columns every new board gets, matching the example in spec
/// section 3 - a board is immediately usable instead of opening empty.
const STARTER_STATUSES: [(&str, &str, bool); 4] = [
    ("New", "#8E8E93", false),
    ("In Progress", "#0A84FF", false),
    ("In Review", "#FF9F0A", false),
    ("Done", "#30D158", true),
];

/// Mirrors `database::schema::DEFAULT_PRIORITIES` - a new board created from
/// the UI gets the same starter set a migrated/fresh-install board gets.
const STARTER_PRIORITIES: [(&str, &str, bool); 4] = [
    ("Low", "#8E8E93", false),
    ("Normal", "#0A84FF", true),
    ("High", "#FF9F0A", false),
    ("Critical", "#FF453A", false),
];

#[tauri::command]
pub fn create_tracker_board(state: State<AppState>, input: BoardInput) -> AppResult<Board> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Board name cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        let id = new_id();
        let now = now_iso();
        boards_db::create(conn, &id, &name, input.description.as_deref(), &now)?;
        for (i, (sname, color, is_done)) in STARTER_STATUSES.iter().enumerate() {
            let sid = new_id();
            statuses_db::create(conn, &sid, &id, sname, color, i == 0, &now)?;
            if *is_done {
                statuses_db::set_is_done(conn, &sid, true, &now)?;
            }
        }
        for (pname, color, make_default) in STARTER_PRIORITIES.iter() {
            priorities_db::create(conn, &new_id(), &id, pname, color, *make_default, &now)?;
        }
        crate::utils::logger::info(storage, &format!("Tracker board created: \"{name}\" ({id})"));
        boards_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create board."))
    })
}

#[tauri::command]
pub fn update_tracker_board(state: State<AppState>, board_id: String, input: BoardInput) -> AppResult<Board> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Board name cannot be empty."));
    }
    with_ready(&state, |conn, storage| {
        let updated = boards_db::update(conn, &board_id, &name, input.description.as_deref(), &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This board no longer exists."));
        }
        crate::utils::logger::info(storage, &format!("Tracker board updated: \"{name}\" ({board_id})"));
        boards_db::get(conn, &board_id)?.ok_or_else(|| AppError::user("Failed to update board."))
    })
}

#[tauri::command]
pub fn set_tracker_board_card_size(state: State<AppState>, board_id: String, card_size: String) -> AppResult<Board> {
    if card_size != "compact" && card_size != "normal" {
        return Err(AppError::user("Invalid card size."));
    }
    with_ready(&state, |conn, _| {
        boards_db::set_card_size(conn, &board_id, &card_size, &now_iso())?;
        boards_db::get(conn, &board_id)?.ok_or_else(|| AppError::user("This board no longer exists."))
    })
}

#[tauri::command]
pub fn reorder_tracker_boards(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<Vec<Board>> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            boards_db::set_position(conn, id, i as i64)?;
        }
        Ok(boards_db::list(conn)?)
    })
}

#[tauri::command]
pub fn delete_tracker_board(state: State<AppState>, board_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if !boards_db::exists(conn, &board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        // Cascades to its statuses/fields/labels/tasks (and, via tasks,
        // task_files/task_events) - never touches the files themselves, only
        // the tracker's own tables (spec section 27/36).
        boards_db::delete(conn, &board_id)?;
        crate::utils::logger::info(storage, &format!("Tracker board deleted: {board_id}"));
        Ok(())
    })
}

// ---- Statuses ---------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_statuses(state: State<AppState>, board_id: String) -> AppResult<Vec<Status>> {
    with_ready(&state, |conn, _| Ok(statuses_db::list_for_board(conn, &board_id)?))
}

#[tauri::command]
pub fn create_tracker_status(state: State<AppState>, board_id: String, input: StatusInput) -> AppResult<Status> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Status name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !boards_db::exists(conn, &board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        let id = new_id();
        statuses_db::create(conn, &id, &board_id, &name, &input.color, false, &now_iso())?;
        statuses_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create status."))
    })
}

#[tauri::command]
pub fn update_tracker_status(state: State<AppState>, status_id: String, input: StatusInput) -> AppResult<Status> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Status name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = statuses_db::update(conn, &status_id, &name, &input.color, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This status no longer exists."));
        }
        statuses_db::get(conn, &status_id)?.ok_or_else(|| AppError::user("Failed to update status."))
    })
}

#[tauri::command]
pub fn set_tracker_status_default(state: State<AppState>, status_id: String) -> AppResult<Vec<Status>> {
    with_ready(&state, |conn, _| {
        let status = statuses_db::get(conn, &status_id)?
            .ok_or_else(|| AppError::user("This status no longer exists."))?;
        statuses_db::set_default(conn, &status_id, &status.board_id, &now_iso())?;
        Ok(statuses_db::list_for_board(conn, &status.board_id)?)
    })
}

#[tauri::command]
pub fn set_tracker_status_is_done(state: State<AppState>, status_id: String, is_done: bool) -> AppResult<Status> {
    with_ready(&state, |conn, _| {
        statuses_db::set_is_done(conn, &status_id, is_done, &now_iso())?;
        statuses_db::get(conn, &status_id)?.ok_or_else(|| AppError::user("This status no longer exists."))
    })
}

#[tauri::command]
pub fn reorder_tracker_statuses(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            statuses_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

/// Deleting a status never deletes the tasks in it (spec section 3). If any
/// remain, the frontend must supply `reassign_to_status_id` - it shows a
/// picker forcing that choice before this is even called with tasks present.
#[tauri::command]
pub fn delete_tracker_status(
    state: State<AppState>,
    status_id: String,
    reassign_to_status_id: Option<String>,
) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let status = statuses_db::get(conn, &status_id)?
            .ok_or_else(|| AppError::user("This status no longer exists."))?;
        if statuses_db::count_for_board(conn, &status.board_id)? <= 1 {
            return Err(AppError::user("A board must keep at least one status."));
        }
        let task_count = statuses_db::count_tasks(conn, &status_id)?;
        if task_count > 0 {
            let target = reassign_to_status_id
                .ok_or_else(|| AppError::user("Choose a status to move its tasks to first."))?;
            if target == status_id {
                return Err(AppError::user("Choose a different status to move its tasks to."));
            }
            if statuses_db::get(conn, &target)?.is_none() {
                return Err(AppError::user("The target status no longer exists."));
            }
            statuses_db::reassign_tasks(conn, &status_id, &target, &now_iso())?;
        }
        let was_default = status.is_default;
        statuses_db::delete(conn, &status_id)?;
        if was_default {
            if let Some(first) = statuses_db::list_for_board(conn, &status.board_id)?.into_iter().next() {
                statuses_db::set_default(conn, &first.id, &status.board_id, &now_iso())?;
            }
        }
        crate::utils::logger::info(storage, &format!("Tracker status deleted: {status_id}"));
        Ok(())
    })
}

// ---- Priorities ---------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_priorities(state: State<AppState>, board_id: String) -> AppResult<Vec<Priority>> {
    with_ready(&state, |conn, _| Ok(priorities_db::list_for_board(conn, &board_id)?))
}

#[tauri::command]
pub fn create_tracker_priority(state: State<AppState>, board_id: String, input: PriorityInput) -> AppResult<Priority> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Priority name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !boards_db::exists(conn, &board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        let id = new_id();
        priorities_db::create(conn, &id, &board_id, &name, &input.color, false, &now_iso())?;
        priorities_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create priority."))
    })
}

#[tauri::command]
pub fn update_tracker_priority(state: State<AppState>, priority_id: String, input: PriorityInput) -> AppResult<Priority> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Priority name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = priorities_db::update(conn, &priority_id, &name, &input.color, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This priority no longer exists."));
        }
        priorities_db::get(conn, &priority_id)?.ok_or_else(|| AppError::user("Failed to update priority."))
    })
}

#[tauri::command]
pub fn set_tracker_priority_default(state: State<AppState>, priority_id: String) -> AppResult<Vec<Priority>> {
    with_ready(&state, |conn, _| {
        let priority = priorities_db::get(conn, &priority_id)?
            .ok_or_else(|| AppError::user("This priority no longer exists."))?;
        priorities_db::set_default(conn, &priority_id, &priority.board_id, &now_iso())?;
        Ok(priorities_db::list_for_board(conn, &priority.board_id)?)
    })
}

#[tauri::command]
pub fn reorder_tracker_priorities(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            priorities_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

/// Deleting a priority never deletes its tasks (mirrors status deletion). If
/// any remain, the frontend must supply `reassign_to_priority_id`.
#[tauri::command]
pub fn delete_tracker_priority(
    state: State<AppState>,
    priority_id: String,
    reassign_to_priority_id: Option<String>,
) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let priority = priorities_db::get(conn, &priority_id)?
            .ok_or_else(|| AppError::user("This priority no longer exists."))?;
        if priorities_db::count_for_board(conn, &priority.board_id)? <= 1 {
            return Err(AppError::user("A board must keep at least one priority."));
        }
        let task_count = priorities_db::count_tasks(conn, &priority_id)?;
        if task_count > 0 {
            let target = reassign_to_priority_id
                .ok_or_else(|| AppError::user("Choose a priority to move its tasks to first."))?;
            if target == priority_id {
                return Err(AppError::user("Choose a different priority to move its tasks to."));
            }
            if priorities_db::get(conn, &target)?.is_none() {
                return Err(AppError::user("The target priority no longer exists."));
            }
            priorities_db::reassign_tasks(conn, &priority_id, &target, &now_iso())?;
        }
        let was_default = priority.is_default;
        priorities_db::delete(conn, &priority_id)?;
        if was_default {
            if let Some(first) = priorities_db::list_for_board(conn, &priority.board_id)?.into_iter().next() {
                priorities_db::set_default(conn, &first.id, &priority.board_id, &now_iso())?;
            }
        }
        crate::utils::logger::info(storage, &format!("Tracker priority deleted: {priority_id}"));
        Ok(())
    })
}

// ---- Custom fields ------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_fields(state: State<AppState>, board_id: String) -> AppResult<Vec<Field>> {
    with_ready(&state, |conn, _| Ok(fields_db::list_for_board(conn, &board_id)?))
}

#[tauri::command]
pub fn create_tracker_field(state: State<AppState>, board_id: String, input: FieldInput) -> AppResult<Field> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Field name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !boards_db::exists(conn, &board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        let id = new_id();
        fields_db::create(conn, &id, &board_id, &name, input.field_type, &input.options, &now_iso())?;
        fields_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create field."))
    })
}

#[tauri::command]
pub fn update_tracker_field(state: State<AppState>, field_id: String, input: FieldInput) -> AppResult<Field> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Field name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = fields_db::update(conn, &field_id, &name, input.field_type, &input.options, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This field no longer exists."));
        }
        fields_db::get(conn, &field_id)?.ok_or_else(|| AppError::user("Failed to update field."))
    })
}

#[tauri::command]
pub fn reorder_tracker_fields(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            fields_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn delete_tracker_field(state: State<AppState>, field_id: String) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        fields_db::delete(conn, &field_id)?;
        Ok(())
    })
}

// ---- Labels -------------------------------------------------------------------

#[tauri::command]
pub fn get_tracker_labels(state: State<AppState>, board_id: String) -> AppResult<Vec<Label>> {
    with_ready(&state, |conn, _| Ok(labels_db::list_for_board(conn, &board_id)?))
}

#[tauri::command]
pub fn create_tracker_label(state: State<AppState>, board_id: String, input: LabelInput) -> AppResult<Label> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Label name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !boards_db::exists(conn, &board_id)? {
            return Err(AppError::user("This board no longer exists."));
        }
        let id = new_id();
        labels_db::create(conn, &id, &board_id, &name, &input.color, &now_iso())?;
        labels_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create label."))
    })
}

#[tauri::command]
pub fn update_tracker_label(state: State<AppState>, label_id: String, input: LabelInput) -> AppResult<Label> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Label name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = labels_db::update(conn, &label_id, &name, &input.color)?;
        if updated == 0 {
            return Err(AppError::user("This label no longer exists."));
        }
        labels_db::get(conn, &label_id)?.ok_or_else(|| AppError::user("Failed to update label."))
    })
}

#[tauri::command]
pub fn reorder_tracker_labels(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            labels_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn delete_tracker_label(state: State<AppState>, label_id: String) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        labels_db::delete(conn, &label_id)?;
        Ok(())
    })
}
