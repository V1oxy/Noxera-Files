use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::Status;

const SELECT_BASE: &str = "SELECT s.id, s.board_id, s.name, s.color, s.position, s.is_default, s.is_done, s.created_at, s.updated_at, \
    (SELECT COUNT(*) FROM tracker_tasks t WHERE t.status_id = s.id AND t.archived = 0) AS task_count \
    FROM tracker_statuses s";

fn map_row(row: &Row) -> rusqlite::Result<Status> {
    Ok(Status {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        position: row.get("position")?,
        is_default: row.get("is_default")?,
        is_done: row.get("is_done")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        task_count: row.get("task_count")?,
    })
}

pub fn list_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Vec<Status>> {
    let sql = format!("{SELECT_BASE} WHERE s.board_id = ?1 ORDER BY s.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Status>> {
    let sql = format!("{SELECT_BASE} WHERE s.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn default_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Option<Status>> {
    let sql = format!("{SELECT_BASE} WHERE s.board_id = ?1 AND s.is_default = 1 LIMIT 1");
    conn.query_row(&sql, params![board_id], map_row).optional()
}

/// Falls back to the first status by position when a board somehow has no
/// status flagged default (shouldn't normally happen - every board is
/// created with one - but a status can be deleted out from under this).
pub fn default_or_first(conn: &Connection, board_id: &str) -> rusqlite::Result<Option<Status>> {
    if let Some(s) = default_for_board(conn, board_id)? {
        return Ok(Some(s));
    }
    let sql = format!("{SELECT_BASE} WHERE s.board_id = ?1 ORDER BY s.position ASC LIMIT 1");
    conn.query_row(&sql, params![board_id], map_row).optional()
}

pub fn next_position(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_statuses WHERE board_id = ?1",
        params![board_id],
        |r| r.get(0),
    )
}

pub fn create(
    conn: &Connection,
    id: &str,
    board_id: &str,
    name: &str,
    color: &str,
    make_default: bool,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, board_id)?;
    if make_default {
        clear_default(conn, board_id)?;
    }
    conn.execute(
        "INSERT INTO tracker_statuses (id, board_id, name, color, position, is_default, is_done, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7)",
        params![id, board_id, name, color, position, make_default, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, color: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_statuses SET name = ?2, color = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, name, color, now],
    )
}

fn clear_default(conn: &Connection, board_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_statuses SET is_default = 0 WHERE board_id = ?1",
        params![board_id],
    )
}

pub fn set_default(conn: &Connection, id: &str, board_id: &str, now: &str) -> rusqlite::Result<()> {
    clear_default(conn, board_id)?;
    conn.execute(
        "UPDATE tracker_statuses SET is_default = 1, updated_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;
    Ok(())
}

pub fn set_is_done(conn: &Connection, id: &str, is_done: bool, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_statuses SET is_done = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, is_done, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_statuses SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn count_tasks(conn: &Connection, status_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM tracker_tasks WHERE status_id = ?1",
        params![status_id],
        |r| r.get(0),
    )
}

pub fn count_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM tracker_statuses WHERE board_id = ?1",
        params![board_id],
        |r| r.get(0),
    )
}

/// Moves every task out of `from_status_id` into `to_status_id`, appending
/// them after whatever is already there - used right before a status is
/// deleted so its tasks are never silently deleted along with it.
pub fn reassign_tasks(conn: &Connection, from_status_id: &str, to_status_id: &str, now: &str) -> rusqlite::Result<usize> {
    let base_position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_tasks WHERE status_id = ?1",
        params![to_status_id],
        |r| r.get(0),
    )?;
    let mut stmt = conn.prepare(
        "SELECT id FROM tracker_tasks WHERE status_id = ?1 ORDER BY position ASC",
    )?;
    let ids: Vec<String> = stmt
        .query_map(params![from_status_id], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<_>>()?;
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE tracker_tasks SET status_id = ?2, position = ?3, updated_at = ?4 WHERE id = ?1",
            params![id, to_status_id, base_position + i as i64, now],
        )?;
    }
    Ok(ids.len())
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_statuses WHERE id = ?1", params![id])
}
