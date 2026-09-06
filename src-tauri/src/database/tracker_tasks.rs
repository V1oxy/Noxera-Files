use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{Priority, SortDirection, Task, TaskDetail, TaskFilter, TaskSortField, TaskUpdateInput};

use super::{tracker_events, tracker_field_values, tracker_task_files};

const SELECT_BASE: &str = "SELECT t.id, t.board_id, b.name AS board_name, t.status_id, s.name AS status_name, \
    s.color AS status_color, s.is_done AS status_is_done, t.title, t.description, t.project_id, p.name AS project_name, \
    t.customer, t.assignee, t.priority, t.pinned, t.archived, t.position, t.received_at, t.due_at, t.completed_at, \
    t.created_at, t.updated_at, \
    (SELECT COUNT(*) FROM tracker_task_files tf WHERE tf.task_id = t.id) AS file_count, \
    (SELECT COUNT(*) FROM tracker_task_files tf WHERE tf.task_id = t.id AND tf.unseen_update = 1) AS unseen_count, \
    (SELECT GROUP_CONCAT(label_id) FROM tracker_task_labels WHERE task_id = t.id) AS label_ids_concat, \
    (SELECT GROUP_CONCAT(cached_file_name, char(31)) FROM tracker_task_files WHERE task_id = t.id) AS file_names_blob, \
    (SELECT GROUP_CONCAT(value, char(31)) FROM tracker_field_values WHERE task_id = t.id AND value IS NOT NULL) AS field_values_blob \
    FROM tracker_tasks t \
    JOIN tracker_boards b ON b.id = t.board_id \
    JOIN tracker_statuses s ON s.id = t.status_id \
    LEFT JOIN projects p ON p.id = t.project_id";

/// A row plus the extra blob columns needed for full-text search, which
/// aren't part of the public `Task` shape - kept alongside it only long
/// enough for `list_all` to filter on, then discarded.
struct RowWithSearchBlob {
    task: Task,
    blob: String,
}

fn map_row(row: &Row) -> rusqlite::Result<RowWithSearchBlob> {
    let priority: String = row.get("priority")?;
    let label_ids_concat: Option<String> = row.get("label_ids_concat")?;
    let label_ids = label_ids_concat
        .map(|s| s.split(',').map(str::to_string).collect())
        .unwrap_or_default();
    let file_names_blob: Option<String> = row.get("file_names_blob")?;
    let field_values_blob: Option<String> = row.get("field_values_blob")?;
    let unseen_count: i64 = row.get("unseen_count")?;

    let task = Task {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        board_name: row.get("board_name")?,
        status_id: row.get("status_id")?,
        status_name: row.get("status_name")?,
        status_color: row.get("status_color")?,
        status_is_done: row.get("status_is_done")?,
        title: row.get("title")?,
        description: row.get("description")?,
        project_id: row.get("project_id")?,
        project_name: row.get("project_name")?,
        customer: row.get("customer")?,
        assignee: row.get("assignee")?,
        priority: Priority::parse(&priority),
        pinned: row.get("pinned")?,
        archived: row.get("archived")?,
        position: row.get("position")?,
        received_at: row.get("received_at")?,
        due_at: row.get("due_at")?,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        file_count: row.get("file_count")?,
        has_unseen_update: unseen_count > 0,
        label_ids,
    };

    let blob = format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}",
        task.title,
        task.description.as_deref().unwrap_or(""),
        task.project_name.as_deref().unwrap_or(""),
        task.customer.as_deref().unwrap_or(""),
        task.assignee.as_deref().unwrap_or(""),
        file_names_blob.as_deref().unwrap_or(""),
        field_values_blob.as_deref().unwrap_or(""),
    );

    Ok(RowWithSearchBlob { task, blob })
}

/// Tasks pinned to the top of their column, then manual drag order - the
/// same rule the frontend must not re-sort past when grouping this list by
/// status client-side for the Kanban view.
const BOARD_ORDER: &str = "ORDER BY t.pinned DESC, t.position ASC";

pub fn list_for_board(conn: &Connection, board_id: &str, include_archived: bool) -> rusqlite::Result<Vec<Task>> {
    let sql = if include_archived {
        format!("{SELECT_BASE} WHERE t.board_id = ?1 {BOARD_ORDER}")
    } else {
        format!("{SELECT_BASE} WHERE t.board_id = ?1 AND t.archived = 0 {BOARD_ORDER}")
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id], map_row)?;
    rows.map(|r| r.map(|rw| rw.task)).collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Task>> {
    let sql = format!("{SELECT_BASE} WHERE t.id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .optional()
        .map(|r| r.map(|rw| rw.task))
}

fn matches_filter(task: &Task, blob: &str, filter: &TaskFilter) -> bool {
    if let Some(term) = filter.search.as_deref().filter(|s| !s.trim().is_empty()) {
        if !blob.to_lowercase().contains(&term.trim().to_lowercase()) {
            return false;
        }
    }
    if let Some(project_id) = &filter.project_id {
        if task.project_id.as_deref() != Some(project_id.as_str()) {
            return false;
        }
    }
    if let Some(board_id) = &filter.board_id {
        if task.board_id != *board_id {
            return false;
        }
    }
    if let Some(status_id) = &filter.status_id {
        if task.status_id != *status_id {
            return false;
        }
    }
    if let Some(customer) = filter.customer.as_deref().filter(|s| !s.trim().is_empty()) {
        let needle = customer.trim().to_lowercase();
        if !task.customer.as_deref().unwrap_or("").to_lowercase().contains(&needle) {
            return false;
        }
    }
    if let Some(assignee) = filter.assignee.as_deref().filter(|s| !s.trim().is_empty()) {
        let needle = assignee.trim().to_lowercase();
        if !task.assignee.as_deref().unwrap_or("").to_lowercase().contains(&needle) {
            return false;
        }
    }
    if let Some(priority) = filter.priority {
        if task.priority != priority {
            return false;
        }
    }
    if let Some(label_id) = &filter.label_id {
        if !task.label_ids.iter().any(|l| l == label_id) {
            return false;
        }
    }
    if let Some(has_files) = filter.has_files {
        if has_files != (task.file_count > 0) {
            return false;
        }
    }
    if filter.overdue_only == Some(true) {
        let now = crate::utils::now_iso();
        let is_overdue = match &task.due_at {
            Some(due) => task.completed_at.is_none() && due.as_str() < now.as_str(),
            None => false,
        };
        if !is_overdue {
            return false;
        }
    }
    if let Some(before) = &filter.due_before {
        if task.due_at.as_deref().map(|d| d > before.as_str()).unwrap_or(true) {
            return false;
        }
    }
    if let Some(after) = &filter.due_after {
        if task.due_at.as_deref().map(|d| d < after.as_str()).unwrap_or(true) {
            return false;
        }
    }
    if let Some(before) = &filter.received_before {
        if task.received_at.as_str() > before.as_str() {
            return false;
        }
    }
    if let Some(after) = &filter.received_after {
        if task.received_at.as_str() < after.as_str() {
            return false;
        }
    }
    if filter.include_archived != Some(true) && task.archived {
        return false;
    }
    true
}

fn sort_key(task: &Task, field: TaskSortField) -> &str {
    match field {
        TaskSortField::Created => &task.created_at,
        TaskSortField::ReceivedAt => &task.received_at,
        TaskSortField::DueAt => task.due_at.as_deref().unwrap_or(""),
        TaskSortField::UpdatedAt => &task.updated_at,
        TaskSortField::CompletedAt => task.completed_at.as_deref().unwrap_or(""),
        TaskSortField::Title => &task.title,
        TaskSortField::Customer => task.customer.as_deref().unwrap_or(""),
        // Priority is sorted separately below (it's an enum, not a string).
        TaskSortField::Priority => "",
    }
}

fn priority_rank(p: Priority) -> u8 {
    match p {
        Priority::Low => 0,
        Priority::Normal => 1,
        Priority::High => 2,
        Priority::Critical => 3,
    }
}

/// Loads every task across every board and applies `filter`'s search,
/// filters and sort entirely in Rust (see `TaskFilter`'s doc comment for
/// why). Backs the cross-board "All Tasks" view.
pub fn list_all(conn: &Connection, filter: &TaskFilter) -> rusqlite::Result<Vec<Task>> {
    let sql = format!("{SELECT_BASE} ORDER BY t.created_at DESC");
    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<RowWithSearchBlob> = stmt.query_map([], map_row)?.collect::<rusqlite::Result<_>>()?;

    let mut tasks: Vec<Task> = rows
        .into_iter()
        .filter(|rw| matches_filter(&rw.task, &rw.blob, filter))
        .map(|rw| rw.task)
        .collect();

    let field = filter.sort_field.unwrap_or(TaskSortField::Created);
    let dir = filter.sort_dir.unwrap_or(SortDirection::Desc);
    if field == TaskSortField::Priority {
        tasks.sort_by_key(|t| priority_rank(t.priority));
    } else if field == TaskSortField::Title || field == TaskSortField::Customer {
        // Case-insensitive for the two free-text fields, so "apple" and
        // "Banana" sort by their letters rather than by ASCII case.
        tasks.sort_by(|a, b| sort_key(a, field).to_lowercase().cmp(&sort_key(b, field).to_lowercase()));
    } else {
        tasks.sort_by(|a, b| sort_key(a, field).cmp(sort_key(b, field)));
    }
    if dir == SortDirection::Desc {
        tasks.reverse();
    }
    // Pinned tasks still float to the top within the sorted list, mirroring
    // the board view's convention.
    tasks.sort_by_key(|t| !t.pinned);
    Ok(tasks)
}

pub fn list_for_project(conn: &Connection, project_id: &str, include_archived: bool) -> rusqlite::Result<Vec<Task>> {
    let sql = if include_archived {
        format!("{SELECT_BASE} WHERE t.project_id = ?1 ORDER BY t.created_at DESC")
    } else {
        format!("{SELECT_BASE} WHERE t.project_id = ?1 AND t.archived = 0 ORDER BY t.created_at DESC")
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![project_id], map_row)?;
    rows.map(|r| r.map(|rw| rw.task)).collect()
}

pub fn list_for_file(conn: &Connection, file_id: &str) -> rusqlite::Result<Vec<Task>> {
    let sql = format!(
        "{SELECT_BASE} WHERE t.id IN (SELECT task_id FROM tracker_task_files WHERE file_id = ?1) \
         AND t.archived = 0 ORDER BY t.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![file_id], map_row)?;
    rows.map(|r| r.map(|rw| rw.task)).collect()
}

pub fn get_detail(conn: &Connection, id: &str, now: &str) -> rusqlite::Result<Option<TaskDetail>> {
    tracker_task_files::sync_always_latest_all(conn, now)?;
    let task = match get(conn, id)? {
        Some(t) => t,
        None => return Ok(None),
    };
    let field_values = tracker_field_values::list_for_task(conn, id)?;
    let files = tracker_task_files::list_for_task(conn, id)?;
    let events = tracker_events::list_for_task(conn, id)?;
    // Opening the task is the acknowledgement point for "file updated"
    // badges (spec section 9) - clear it *after* building `files` above so
    // this exact response still shows the badge that brought the user here.
    tracker_task_files::clear_unseen(conn, id)?;
    Ok(Some(TaskDetail { task, field_values, files, events }))
}

pub fn next_position(conn: &Connection, status_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_tasks WHERE status_id = ?1",
        params![status_id],
        |r| r.get(0),
    )
}

#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    board_id: &str,
    status_id: &str,
    title: &str,
    description: Option<&str>,
    project_id: Option<&str>,
    customer: Option<&str>,
    assignee: Option<&str>,
    priority: Priority,
    received_at: &str,
    due_at: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, status_id)?;
    conn.execute(
        "INSERT INTO tracker_tasks \
         (id, board_id, status_id, title, description, project_id, customer, assignee, priority, \
          pinned, archived, position, received_at, due_at, completed_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, 0, ?10, ?11, ?12, NULL, ?13, ?13)",
        params![
            id, board_id, status_id, title, description, project_id, customer, assignee,
            priority.as_str(), position, received_at, due_at, now,
        ],
    )?;
    Ok(())
}

pub struct RawTaskColumns {
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub customer: Option<String>,
    pub assignee: Option<String>,
    pub priority: String,
    pub received_at: String,
    pub due_at: Option<String>,
    pub completed_at: Option<String>,
    pub pinned: bool,
}

fn get_raw(conn: &Connection, id: &str) -> rusqlite::Result<Option<RawTaskColumns>> {
    conn.query_row(
        "SELECT title, description, project_id, customer, assignee, priority, received_at, due_at, completed_at, pinned \
         FROM tracker_tasks WHERE id = ?1",
        params![id],
        |row| {
            Ok(RawTaskColumns {
                title: row.get(0)?,
                description: row.get(1)?,
                project_id: row.get(2)?,
                customer: row.get(3)?,
                assignee: row.get(4)?,
                priority: row.get(5)?,
                received_at: row.get(6)?,
                due_at: row.get(7)?,
                completed_at: row.get(8)?,
                pinned: row.get(9)?,
            })
        },
    )
    .optional()
}

/// Applies a `TaskUpdateInput` patch: any field left as `None` keeps its
/// current value, so every caller only needs to send what actually changed.
/// Returns the merged, pre-write column values so the command layer can diff
/// old vs new for history logging without a second SELECT.
pub fn apply_update(
    conn: &Connection,
    id: &str,
    patch: &TaskUpdateInput,
    now: &str,
) -> rusqlite::Result<Option<(RawTaskColumns, RawTaskColumns)>> {
    let existing = match get_raw(conn, id)? {
        Some(r) => r,
        None => return Ok(None),
    };
    let merged = RawTaskColumns {
        title: patch.title.clone().unwrap_or_else(|| existing.title.clone()),
        description: patch.description.clone().unwrap_or_else(|| existing.description.clone()),
        project_id: patch.project_id.clone().unwrap_or_else(|| existing.project_id.clone()),
        customer: patch.customer.clone().unwrap_or_else(|| existing.customer.clone()),
        assignee: patch.assignee.clone().unwrap_or_else(|| existing.assignee.clone()),
        priority: patch.priority.map(|p| p.as_str().to_string()).unwrap_or_else(|| existing.priority.clone()),
        received_at: patch.received_at.clone().unwrap_or_else(|| existing.received_at.clone()),
        due_at: patch.due_at.clone().unwrap_or_else(|| existing.due_at.clone()),
        completed_at: patch.completed_at.clone().unwrap_or_else(|| existing.completed_at.clone()),
        pinned: patch.pinned.unwrap_or(existing.pinned),
    };
    conn.execute(
        "UPDATE tracker_tasks SET title = ?2, description = ?3, project_id = ?4, customer = ?5, assignee = ?6, \
         priority = ?7, received_at = ?8, due_at = ?9, completed_at = ?10, pinned = ?11, updated_at = ?12 WHERE id = ?1",
        params![
            id, merged.title, merged.description, merged.project_id, merged.customer, merged.assignee,
            merged.priority, merged.received_at, merged.due_at, merged.completed_at, merged.pinned, now,
        ],
    )?;
    Ok(Some((existing, merged)))
}

pub fn set_status(conn: &Connection, id: &str, status_id: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_tasks SET status_id = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, status_id, now],
    )
}

pub fn set_completed_at(conn: &Connection, id: &str, completed_at: Option<&str>, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_tasks SET completed_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, completed_at, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_tasks SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn set_pinned(conn: &Connection, id: &str, pinned: bool, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_tasks SET pinned = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, pinned, now],
    )
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_tasks SET archived = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, archived, now],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_tasks WHERE id = ?1", params![id])
}
