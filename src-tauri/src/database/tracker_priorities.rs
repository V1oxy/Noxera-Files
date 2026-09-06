use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::Priority;

const SELECT_BASE: &str = "SELECT p.id, p.board_id, p.name, p.color, p.position, p.is_default, p.created_at, p.updated_at, \
    (SELECT COUNT(*) FROM tracker_tasks t WHERE t.priority = p.id AND t.archived = 0) AS task_count \
    FROM tracker_priorities p";

fn map_row(row: &Row) -> rusqlite::Result<Priority> {
    Ok(Priority {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        position: row.get("position")?,
        is_default: row.get("is_default")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        task_count: row.get("task_count")?,
    })
}

pub fn list_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Vec<Priority>> {
    let sql = format!("{SELECT_BASE} WHERE p.board_id = ?1 ORDER BY p.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Priority>> {
    let sql = format!("{SELECT_BASE} WHERE p.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn default_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Option<Priority>> {
    let sql = format!("{SELECT_BASE} WHERE p.board_id = ?1 AND p.is_default = 1 LIMIT 1");
    conn.query_row(&sql, params![board_id], map_row).optional()
}

/// Falls back to the first priority by position when a board somehow has
/// none flagged default (shouldn't normally happen - every board is seeded
/// with one - but the default one can be deleted).
pub fn default_or_first(conn: &Connection, board_id: &str) -> rusqlite::Result<Option<Priority>> {
    if let Some(p) = default_for_board(conn, board_id)? {
        return Ok(Some(p));
    }
    let sql = format!("{SELECT_BASE} WHERE p.board_id = ?1 ORDER BY p.position ASC LIMIT 1");
    conn.query_row(&sql, params![board_id], map_row).optional()
}

pub fn next_position(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_priorities WHERE board_id = ?1",
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
        "INSERT INTO tracker_priorities (id, board_id, name, color, position, is_default, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![id, board_id, name, color, position, make_default, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, color: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_priorities SET name = ?2, color = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, name, color, now],
    )
}

fn clear_default(conn: &Connection, board_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_priorities SET is_default = 0 WHERE board_id = ?1",
        params![board_id],
    )
}

pub fn set_default(conn: &Connection, id: &str, board_id: &str, now: &str) -> rusqlite::Result<()> {
    clear_default(conn, board_id)?;
    conn.execute(
        "UPDATE tracker_priorities SET is_default = 1, updated_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;
    Ok(())
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_priorities SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn count_tasks(conn: &Connection, priority_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM tracker_tasks WHERE priority = ?1",
        params![priority_id],
        |r| r.get(0),
    )
}

pub fn count_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM tracker_priorities WHERE board_id = ?1",
        params![board_id],
        |r| r.get(0),
    )
}

/// Moves every task off `from_priority_id` onto `to_priority_id` - used right
/// before a priority is deleted so its tasks are never left pointing at a row
/// that no longer exists.
pub fn reassign_tasks(conn: &Connection, from_priority_id: &str, to_priority_id: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_tasks SET priority = ?2, updated_at = ?3 WHERE priority = ?1",
        params![from_priority_id, to_priority_id, now],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_priorities WHERE id = ?1", params![id])
}
