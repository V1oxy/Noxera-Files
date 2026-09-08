use rusqlite::{params, Connection, OptionalExtension, Row, ToSql};

use crate::models::{SortDirection, Task, TaskDetail, TaskFilter, TaskSortField, TaskUpdateInput, TrackerExportFilter};

use super::{tracker_events, tracker_field_values, tracker_task_files, tracker_task_local_files};

/// Every column `Task` needs, including three correlated-but-indexed
/// subqueries (`tracker_task_files.task_id` and the
/// `tracker_task_labels`/`tracker_field_values` composite primary keys all
/// lead with the join column) so per-row cost is an index lookup, not a
/// table scan, regardless of table size.
const SELECT_BASE: &str = "SELECT t.id, t.board_id, b.name AS board_name, t.status_id, s.name AS status_name, \
    s.color AS status_color, s.is_done AS status_is_done, t.title, t.description, t.project_id, p.name AS project_name, \
    t.customer, t.priority AS priority_id, pr.name AS priority_name, pr.color AS priority_color, \
    pr.position AS priority_position, t.pinned, t.archived, t.position, t.received_at, t.completed_at, \
    t.created_at, t.updated_at, \
    (SELECT COUNT(*) FROM tracker_task_files tf WHERE tf.task_id = t.id) AS file_count, \
    (SELECT COUNT(*) FROM tracker_task_files tf WHERE tf.task_id = t.id AND tf.unseen_update = 1) AS unseen_count, \
    (SELECT GROUP_CONCAT(label_id) FROM tracker_task_labels WHERE task_id = t.id) AS label_ids_concat \
    FROM tracker_tasks t \
    JOIN tracker_boards b ON b.id = t.board_id \
    JOIN tracker_statuses s ON s.id = t.status_id \
    JOIN tracker_priorities pr ON pr.id = t.priority \
    LEFT JOIN projects p ON p.id = t.project_id";

fn map_row(row: &Row) -> rusqlite::Result<Task> {
    let label_ids_concat: Option<String> = row.get("label_ids_concat")?;
    let label_ids = label_ids_concat
        .map(|s| s.split(',').map(str::to_string).collect())
        .unwrap_or_default();
    let unseen_count: i64 = row.get("unseen_count")?;

    Ok(Task {
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
        priority_id: row.get("priority_id")?,
        priority_name: row.get("priority_name")?,
        priority_color: row.get("priority_color")?,
        priority_position: row.get("priority_position")?,
        pinned: row.get("pinned")?,
        archived: row.get("archived")?,
        position: row.get("position")?,
        received_at: row.get("received_at")?,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        file_count: row.get("file_count")?,
        has_unseen_update: unseen_count > 0,
        label_ids,
    })
}

/// Tasks pinned to the top of their column, then manual drag order - the
/// same rule the frontend must not re-sort past when grouping this list by
/// status client-side for the Kanban view.
const BOARD_ORDER: &str = "ORDER BY t.pinned DESC, t.position ASC";

/// Loads a board's tasks for the Kanban view. `per_status_limit`, when set,
/// caps how many tasks come back *per status column* (via a `ROW_NUMBER()`
/// window, not a plain `LIMIT` - a plain limit would just return the first N
/// tasks board-wide and could starve later columns entirely) - the initial
/// board load always passes one, so opening a board costs the same whether
/// it holds 50 tasks or 200,000; a column past that cap gets the rest one
/// page at a time from `list_for_board_column` as the user scrolls it.
pub fn list_for_board(
    conn: &Connection,
    board_id: &str,
    include_archived: bool,
    per_status_limit: Option<i64>,
) -> rusqlite::Result<Vec<Task>> {
    let archived_clause = if include_archived { "" } else { "AND t.archived = 0" };
    match per_status_limit {
        None => {
            let sql = format!("{SELECT_BASE} WHERE t.board_id = ?1 {archived_clause} {BOARD_ORDER}");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![board_id], map_row)?;
            rows.collect()
        }
        Some(limit) => {
            // The window function only needs to look at bare `tracker_tasks`
            // columns to pick which ids qualify - computing it against the
            // full `SELECT_BASE` (joins + 3 correlated subqueries) would
            // force those subqueries to run for every task on the board
            // before the window could discard most of them. Instead, narrow
            // to the qualifying ids first (cheap - one table, no joins) and
            // only then run the real, subquery-bearing select for exactly
            // those rows - as an explicit JOIN against that narrowed set
            // rather than a `WHERE t.id IN (...)`, since SQLite reliably
            // materializes a FROM-clause subquery once, while a window
            // function inside an IN-subquery isn't eligible for the usual
            // subquery flattening and can otherwise get re-evaluated per
            // outer row (catastrophic - a full per-status sort repeated once
            // per task on the board instead of once total).
            let sql = format!(
                "{SELECT_BASE} JOIN (\
                   SELECT id FROM (\
                     SELECT id, ROW_NUMBER() OVER (PARTITION BY status_id ORDER BY pinned DESC, position ASC) AS rn \
                     FROM tracker_tasks t WHERE t.board_id = ?1 {archived_clause}\
                   ) WHERE rn <= ?2\
                 ) ranked ON ranked.id = t.id \
                 {BOARD_ORDER}"
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![board_id, limit], map_row)?;
            rows.collect()
        }
    }
}

/// One status column's next page (for "load more" once a column has more
/// tasks than `list_for_board`'s initial `per_status_limit` showed).
pub fn list_for_board_column(
    conn: &Connection,
    board_id: &str,
    status_id: &str,
    include_archived: bool,
    limit: i64,
    offset: i64,
) -> rusqlite::Result<Vec<Task>> {
    let archived_clause = if include_archived { "" } else { "AND t.archived = 0" };
    let sql = format!("{SELECT_BASE} WHERE t.board_id = ?1 AND t.status_id = ?2 {archived_clause} {BOARD_ORDER} LIMIT ?3 OFFSET ?4");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id, status_id, limit, offset], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Task>> {
    let sql = format!("{SELECT_BASE} WHERE t.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

fn sort_column(field: TaskSortField) -> &'static str {
    match field {
        TaskSortField::Created => "t.created_at",
        TaskSortField::ReceivedAt => "t.received_at",
        TaskSortField::UpdatedAt => "t.updated_at",
        TaskSortField::CompletedAt => "COALESCE(t.completed_at, '')",
        TaskSortField::Title => "t.title COLLATE NOCASE",
        TaskSortField::Customer => "COALESCE(t.customer, '') COLLATE NOCASE",
        // Priority sorts by its board-defined position, not a string -
        // `priority_position` is SELECT_BASE's own alias for `pr.position`,
        // referencing it here is standard SQLite (an ORDER BY may name a
        // result-column alias, not just a source-table column).
        TaskSortField::Priority => "priority_position",
    }
}

/// Loads tasks matching `filter` - search, every filter field, sort and
/// pagination are all translated into one parameterized SQL query (WHERE/
/// EXISTS clauses + ORDER BY + LIMIT/OFFSET), so cost is proportional to
/// `filter.limit`, never to the total number of tasks across every board.
/// Backs the cross-board "All Tasks" view (which always sets `limit`) and,
/// with `limit` left `None`, the Excel export (which legitimately wants
/// every matching row for a one-off report).
pub fn list_all(conn: &Connection, filter: &TaskFilter) -> rusqlite::Result<Vec<Task>> {
    let mut clauses: Vec<String> = Vec::new();
    let mut args: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(term) = filter.search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // `lower_unicode` (registered in `database::open`) rather than SQLite's
        // built-in `LOWER()`, which only case-folds ASCII and would miss e.g.
        // Cyrillic "Клиентский" matching "кли".
        let pattern = format!("%{}%", term.to_lowercase());
        clauses.push(
            "(lower_unicode(t.title) LIKE ? \
              OR lower_unicode(COALESCE(t.description, '')) LIKE ? \
              OR lower_unicode(COALESCE(p.name, '')) LIKE ? \
              OR lower_unicode(COALESCE(t.customer, '')) LIKE ? \
              OR EXISTS (SELECT 1 FROM tracker_task_files tf WHERE tf.task_id = t.id AND lower_unicode(COALESCE(tf.cached_file_name, '')) LIKE ?) \
              OR EXISTS (SELECT 1 FROM tracker_field_values fv WHERE fv.task_id = t.id AND fv.value IS NOT NULL AND lower_unicode(fv.value) LIKE ?))"
                .to_string(),
        );
        for _ in 0..6 {
            args.push(Box::new(pattern.clone()));
        }
    }
    if let Some(project_id) = &filter.project_id {
        clauses.push("t.project_id = ?".to_string());
        args.push(Box::new(project_id.clone()));
    }
    if let Some(board_id) = &filter.board_id {
        clauses.push("t.board_id = ?".to_string());
        args.push(Box::new(board_id.clone()));
    }
    if let Some(status_id) = &filter.status_id {
        clauses.push("t.status_id = ?".to_string());
        args.push(Box::new(status_id.clone()));
    }
    if let Some(customer) = filter.customer.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        clauses.push("lower_unicode(COALESCE(t.customer, '')) LIKE ?".to_string());
        args.push(Box::new(format!("%{}%", customer.to_lowercase())));
    }
    if let Some(priority_id) = &filter.priority_id {
        clauses.push("t.priority = ?".to_string());
        args.push(Box::new(priority_id.clone()));
    }
    if let Some(label_id) = &filter.label_id {
        clauses.push("EXISTS (SELECT 1 FROM tracker_task_labels tl WHERE tl.task_id = t.id AND tl.label_id = ?)".to_string());
        args.push(Box::new(label_id.clone()));
    }
    if let Some(has_files) = filter.has_files {
        let exists = "EXISTS (SELECT 1 FROM tracker_task_files tf WHERE tf.task_id = t.id)";
        clauses.push(if has_files { exists.to_string() } else { format!("NOT {exists}") });
    }
    if let Some(before) = &filter.received_before {
        clauses.push("t.received_at <= ?".to_string());
        args.push(Box::new(before.clone()));
    }
    if let Some(after) = &filter.received_after {
        clauses.push("t.received_at >= ?".to_string());
        args.push(Box::new(after.clone()));
    }
    if filter.include_archived != Some(true) {
        clauses.push("t.archived = 0".to_string());
    }

    let where_sql = if clauses.is_empty() { String::new() } else { format!("WHERE {}", clauses.join(" AND ")) };

    let field = filter.sort_field.unwrap_or(TaskSortField::Created);
    let dir = if filter.sort_dir.unwrap_or(SortDirection::Desc) == SortDirection::Desc { "DESC" } else { "ASC" };
    let order_sql = format!("ORDER BY t.pinned DESC, {} {dir}", sort_column(field));

    let limit_sql = if let Some(limit) = filter.limit {
        args.push(Box::new(limit));
        args.push(Box::new(filter.offset.unwrap_or(0)));
        "LIMIT ? OFFSET ?".to_string()
    } else {
        String::new()
    };

    let sql = format!("{SELECT_BASE} {where_sql} {order_sql} {limit_sql}");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(args.iter().map(|a| a.as_ref())), map_row)?;
    rows.collect()
}

/// Backs the Excel export (see `commands::tracker_export`) - reuses
/// `list_all` for everything `TaskFilter` already knows how to do (project
/// scoping, the `received_at` date range, always including archived tasks
/// since a report shouldn't silently drop historical ones, and no `limit` -
/// an export legitimately wants every matching row), then applies the one
/// thing `TaskFilter` doesn't support: matching against several statuses at
/// once rather than just one.
pub fn list_for_export(conn: &Connection, filter: &TrackerExportFilter) -> rusqlite::Result<Vec<Task>> {
    let base_filter = TaskFilter {
        project_id: filter.project_id.clone(),
        received_after: Some(filter.date_from.clone()),
        received_before: Some(format!("{}T23:59:59", filter.date_to)),
        include_archived: Some(true),
        ..Default::default()
    };
    let mut tasks = list_all(conn, &base_filter)?;
    if !filter.status_ids.is_empty() {
        tasks.retain(|t| filter.status_ids.contains(&t.status_id));
    }
    Ok(tasks)
}

pub fn list_for_file(conn: &Connection, file_id: &str) -> rusqlite::Result<Vec<Task>> {
    let sql = format!(
        "{SELECT_BASE} WHERE t.id IN (SELECT task_id FROM tracker_task_files WHERE file_id = ?1) \
         AND t.archived = 0 ORDER BY t.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![file_id], map_row)?;
    rows.collect()
}

pub fn get_detail(conn: &Connection, id: &str, now: &str) -> rusqlite::Result<Option<TaskDetail>> {
    tracker_task_files::sync_always_latest_all(conn, now)?;
    let task = match get(conn, id)? {
        Some(t) => t,
        None => return Ok(None),
    };
    let field_values = tracker_field_values::list_for_task(conn, id)?;
    let files = tracker_task_files::list_for_task(conn, id)?;
    let local_files = tracker_task_local_files::list_for_task(conn, id)?;
    let events = tracker_events::list_for_task(conn, id)?;
    // Opening the task is the acknowledgement point for "file updated"
    // badges (spec section 9) - clear it *after* building `files` above so
    // this exact response still shows the badge that brought the user here.
    tracker_task_files::clear_unseen(conn, id)?;
    Ok(Some(TaskDetail { task, field_values, files, local_files, events }))
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
    priority_id: &str,
    received_at: &str,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, status_id)?;
    conn.execute(
        "INSERT INTO tracker_tasks \
         (id, board_id, status_id, title, description, project_id, customer, priority, \
          pinned, archived, position, received_at, completed_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, ?9, ?10, NULL, ?11, ?11)",
        params![
            id, board_id, status_id, title, description, project_id, customer,
            priority_id, position, received_at, now,
        ],
    )?;
    Ok(())
}

pub struct RawTaskColumns {
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub customer: Option<String>,
    pub priority_id: String,
    pub received_at: String,
    pub completed_at: Option<String>,
    pub pinned: bool,
}

fn get_raw(conn: &Connection, id: &str) -> rusqlite::Result<Option<RawTaskColumns>> {
    conn.query_row(
        "SELECT title, description, project_id, customer, priority, received_at, completed_at, pinned \
         FROM tracker_tasks WHERE id = ?1",
        params![id],
        |row| {
            Ok(RawTaskColumns {
                title: row.get(0)?,
                description: row.get(1)?,
                project_id: row.get(2)?,
                customer: row.get(3)?,
                priority_id: row.get(4)?,
                received_at: row.get(5)?,
                completed_at: row.get(6)?,
                pinned: row.get(7)?,
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
        priority_id: patch.priority_id.clone().unwrap_or_else(|| existing.priority_id.clone()),
        received_at: patch.received_at.clone().unwrap_or_else(|| existing.received_at.clone()),
        completed_at: patch.completed_at.clone().unwrap_or_else(|| existing.completed_at.clone()),
        pinned: patch.pinned.unwrap_or(existing.pinned),
    };
    conn.execute(
        "UPDATE tracker_tasks SET title = ?2, description = ?3, project_id = ?4, customer = ?5, \
         priority = ?6, received_at = ?7, completed_at = ?8, pinned = ?9, updated_at = ?10 WHERE id = ?1",
        params![
            id, merged.title, merged.description, merged.project_id, merged.customer,
            merged.priority_id, merged.received_at, merged.completed_at, merged.pinned, now,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{tracker_boards, tracker_priorities, tracker_statuses};

    struct Fixture {
        conn: Connection,
        dir: std::path::PathBuf,
        board_id: String,
        status_a: String,
        status_b: String,
        priority_low: String,
        priority_high: String,
    }

    fn setup() -> Fixture {
        let dir = std::env::temp_dir().join(format!("noxera-tasks-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = crate::database::open(&dir.join("test.db")).unwrap();
        let now = "2026-01-01T00:00:00+00:00";

        let board_id = "board-1".to_string();
        tracker_boards::create(&conn, &board_id, "Board", None, now).unwrap();
        let status_a = "status-a".to_string();
        let status_b = "status-b".to_string();
        tracker_statuses::create(&conn, &status_a, &board_id, "Todo", "#000", true, now).unwrap();
        tracker_statuses::create(&conn, &status_b, &board_id, "Done", "#000", false, now).unwrap();
        let priority_low = "priority-low".to_string();
        let priority_high = "priority-high".to_string();
        tracker_priorities::create(&conn, &priority_low, &board_id, "Low", "#000", true, now).unwrap();
        tracker_priorities::create(&conn, &priority_high, &board_id, "High", "#000", false, now).unwrap();

        Fixture { conn, dir, board_id, status_a, status_b, priority_low, priority_high }
    }

    fn teardown(f: Fixture) {
        drop(f.conn);
        std::fs::remove_dir_all(&f.dir).ok();
    }

    fn ids(tasks: &[Task]) -> Vec<&str> {
        tasks.iter().map(|t| t.id.as_str()).collect()
    }

    #[test]
    fn list_all_filters_search_and_sort() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&f.conn, "t1", &f.board_id, &f.status_a, "Alpha task", Some("about apples"), None, Some("Acme"), &f.priority_low, "2026-01-01", now).unwrap();
        create(&f.conn, "t2", &f.board_id, &f.status_a, "Beta task", None, None, None, &f.priority_high, "2026-01-02", now).unwrap();
        create(&f.conn, "t3", &f.board_id, &f.status_b, "Gamma task", None, None, None, &f.priority_low, "2026-01-03", now).unwrap();

        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("beta".into()), ..Default::default() }).unwrap()), vec!["t2"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("apples".into()), ..Default::default() }).unwrap()), vec!["t1"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { status_id: Some(f.status_b.clone()), ..Default::default() }).unwrap()), vec!["t3"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { customer: Some("acme".into()), ..Default::default() }).unwrap()), vec!["t1"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { priority_id: Some(f.priority_high.clone()), ..Default::default() }).unwrap()), vec!["t2"]);

        let sorted = list_all(&f.conn, &TaskFilter { sort_field: Some(TaskSortField::ReceivedAt), sort_dir: Some(SortDirection::Asc), ..Default::default() }).unwrap();
        assert_eq!(ids(&sorted), vec!["t1", "t2", "t3"]);

        teardown(f);
    }

    /// Reproduces a reported bug: searching "кли" found nothing for a task
    /// titled "Клиентский возврат" because SQLite's built-in `LOWER()` only
    /// case-folds ASCII, so `LOWER('Клиентский')` stays capitalized and never
    /// matches a lowercase pattern - `lower_unicode()` (a Rust-backed scalar
    /// function) must be used instead so Cyrillic case-folds correctly, and a
    /// search must match a substring anywhere in the title, not just at the
    /// start of a word.
    #[test]
    fn list_all_search_is_unicode_case_insensitive_and_matches_mid_word() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&f.conn, "t1", &f.board_id, &f.status_a, "Отчёт Агента СТОКМАНН.docx", None, None, None, &f.priority_low, "2026-01-01", now).unwrap();
        create(&f.conn, "t2", &f.board_id, &f.status_a, "Автоматическое уведомление по перенесённым заказам", None, None, None, &f.priority_low, "2026-01-02", now).unwrap();
        create(&f.conn, "t3", &f.board_id, &f.status_b, "Клиентский возврат", None, None, None, &f.priority_low, "2026-01-03", now).unwrap();

        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("кли".into()), ..Default::default() }).unwrap()), vec!["t3"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("возв".into()), ..Default::default() }).unwrap()), vec!["t3"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("агент".into()), ..Default::default() }).unwrap()), vec!["t1"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("уведом".into()), ..Default::default() }).unwrap()), vec!["t2"]);
        // Uppercase query against a lowercase-starting title, and a match
        // mid-word rather than at a word boundary.
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("КЛИЕНТ".into()), ..Default::default() }).unwrap()), vec!["t3"]);
        assert_eq!(ids(&list_all(&f.conn, &TaskFilter { search: Some("тский".into()), ..Default::default() }).unwrap()), vec!["t3"]);

        teardown(f);
    }

    /// Reproduces a user report that the Excel export "only exports
    /// completed tasks": a not-done and a done task, both received on the
    /// same date, inside the export's date range - both must come back when
    /// no status is selected (empty `status_ids` means "every status"), and
    /// the date range must be checked against `received_at` (creation/
    /// intake date), not `completed_at` (which the not-done task doesn't
    /// even have).
    #[test]
    fn list_for_export_includes_every_status_by_default_and_filters_on_received_at() {
        let f = setup();
        let now = "2026-01-05T00:00:00+00:00";
        create(&f.conn, "open", &f.board_id, &f.status_a, "Still open", None, None, None, &f.priority_low, "2026-01-02", now).unwrap();
        create(&f.conn, "done", &f.board_id, &f.status_b, "Wrapped up", None, None, None, &f.priority_low, "2026-01-03", now).unwrap();
        set_completed_at(&f.conn, "done", Some("2026-01-04T00:00:00+00:00"), now).unwrap();
        // Received outside the export's date range - must be excluded even
        // though it's otherwise identical to "open".
        create(&f.conn, "out-of-range", &f.board_id, &f.status_a, "Too early", None, None, None, &f.priority_low, "2025-12-01", now).unwrap();

        let filter = TrackerExportFilter {
            project_id: None,
            status_ids: Vec::new(),
            date_from: "2026-01-01".to_string(),
            date_to: "2026-01-31".to_string(),
        };
        let exported = list_for_export(&f.conn, &filter).unwrap();
        let mut result_ids = ids(&exported);
        result_ids.sort_unstable();
        assert_eq!(result_ids, vec!["done", "open"]);

        teardown(f);
    }

    #[test]
    fn list_all_paginates_with_limit_and_offset() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        for i in 0..5 {
            create(&f.conn, &format!("t{i}"), &f.board_id, &f.status_a, &format!("Task {i}"), None, None, None, &f.priority_low, &format!("2026-01-0{}", i + 1), now).unwrap();
        }
        let sort = TaskFilter { sort_field: Some(TaskSortField::ReceivedAt), sort_dir: Some(SortDirection::Asc), ..Default::default() };

        let page1 = list_all(&f.conn, &TaskFilter { limit: Some(2), offset: Some(0), ..sort.clone() }).unwrap();
        assert_eq!(ids(&page1), vec!["t0", "t1"]);
        let page2 = list_all(&f.conn, &TaskFilter { limit: Some(2), offset: Some(2), ..sort.clone() }).unwrap();
        assert_eq!(ids(&page2), vec!["t2", "t3"]);
        let page3 = list_all(&f.conn, &TaskFilter { limit: Some(2), offset: Some(4), ..sort }).unwrap();
        assert_eq!(ids(&page3), vec!["t4"]);

        teardown(f);
    }

    #[test]
    fn list_all_floats_pinned_tasks_above_the_requested_sort_order() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&f.conn, "t1", &f.board_id, &f.status_a, "First", None, None, None, &f.priority_low, "2026-01-01", now).unwrap();
        create(&f.conn, "t2", &f.board_id, &f.status_a, "Second", None, None, None, &f.priority_low, "2026-01-02", now).unwrap();
        create(&f.conn, "t3", &f.board_id, &f.status_a, "Third", None, None, None, &f.priority_low, "2026-01-03", now).unwrap();
        set_pinned(&f.conn, "t3", true, now).unwrap();

        let hits = list_all(&f.conn, &TaskFilter { sort_field: Some(TaskSortField::ReceivedAt), sort_dir: Some(SortDirection::Asc), ..Default::default() }).unwrap();
        // t3 is pinned so it floats to the top even though its receivedAt sorts last.
        assert_eq!(ids(&hits), vec!["t3", "t1", "t2"]);

        teardown(f);
    }

    #[test]
    fn list_all_excludes_archived_unless_asked_for() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&f.conn, "t1", &f.board_id, &f.status_a, "Active", None, None, None, &f.priority_low, "2026-01-01", now).unwrap();
        create(&f.conn, "t2", &f.board_id, &f.status_a, "Archived", None, None, None, &f.priority_low, "2026-01-01", now).unwrap();
        set_archived(&f.conn, "t2", true, now).unwrap();

        assert_eq!(ids(&list_all(&f.conn, &TaskFilter::default()).unwrap()), vec!["t1"]);
        assert_eq!(list_all(&f.conn, &TaskFilter { include_archived: Some(true), ..Default::default() }).unwrap().len(), 2);

        teardown(f);
    }

    #[test]
    fn list_for_board_caps_per_status_column_without_starving_others() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        for i in 0..5 {
            create(&f.conn, &format!("a{i}"), &f.board_id, &f.status_a, &format!("A{i}"), None, None, None, &f.priority_low, "2026-01-01", now).unwrap();
        }
        create(&f.conn, "b0", &f.board_id, &f.status_b, "B0", None, None, None, &f.priority_low, "2026-01-01", now).unwrap();

        let capped = list_for_board(&f.conn, &f.board_id, false, Some(2)).unwrap();
        assert_eq!(capped.iter().filter(|t| t.status_id == f.status_a).count(), 2, "column A must be capped even though it has 5 tasks");
        assert_eq!(capped.iter().filter(|t| t.status_id == f.status_b).count(), 1, "column B's only task must still come back, not get starved by column A's cap");

        let page2 = list_for_board_column(&f.conn, &f.board_id, &f.status_a, false, 2, 2).unwrap();
        assert_eq!(page2.len(), 2);
        let page3 = list_for_board_column(&f.conn, &f.board_id, &f.status_a, false, 2, 4).unwrap();
        assert_eq!(page3.len(), 1);

        teardown(f);
    }

    /// Not a correctness test - seeds 200,000 tracker tasks into a
    /// throwaway database, then times the exact paginated query paths the
    /// Kanban board and "All Tasks" view now run through, to confirm cost
    /// stays flat (proportional to the page size, not to 200,000) after
    /// moving off the old "load everything, filter/sort in Rust" approach.
    ///
    /// Run explicitly: `cargo test --release two_hundred_thousand -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn two_hundred_thousand_tasks_stay_fast_to_page() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";
        const N: usize = 200_000;

        let seed_start = std::time::Instant::now();
        {
            let tx = f.conn.unchecked_transaction().unwrap();
            {
                let mut stmt = tx
                    .prepare(
                        "INSERT INTO tracker_tasks \
                         (id, board_id, status_id, title, description, project_id, customer, priority, \
                          pinned, archived, position, received_at, completed_at, created_at, updated_at) \
                         VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, ?5, 0, 0, ?6, ?7, NULL, ?8, ?8)",
                    )
                    .unwrap();
                for i in 0..N {
                    let status = if i % 2 == 0 { &f.status_a } else { &f.status_b };
                    stmt.execute(params![
                        format!("t{i}"), f.board_id, status, format!("Task number {i}"), f.priority_low, i as i64, "2026-01-01", now,
                    ])
                    .unwrap();
                }
            }
            tx.commit().unwrap();
        }
        eprintln!("seed {N} tasks (raw batched insert): {:?}", seed_start.elapsed());

        let board_start = std::time::Instant::now();
        let capped = list_for_board(&f.conn, &f.board_id, false, Some(100)).unwrap();
        eprintln!("list_for_board, capped at 100/column, over {N} rows: {:?}", board_start.elapsed());
        assert_eq!(capped.len(), 200); // 100 from each of the 2 status columns

        let all_start = std::time::Instant::now();
        let page = list_all(&f.conn, &TaskFilter { limit: Some(150), ..Default::default() }).unwrap();
        eprintln!("list_all, one page of 150, over {N} rows: {:?}", all_start.elapsed());
        assert_eq!(page.len(), 150);

        let search_start = std::time::Instant::now();
        let hits = list_all(&f.conn, &TaskFilter { search: Some("199999".into()), limit: Some(150), ..Default::default() }).unwrap();
        eprintln!("list_all, search + one page of 150, over {N} rows: {:?}", search_start.elapsed());
        assert_eq!(hits.len(), 1);

        teardown(f);
    }
}
