use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::Board;

const SELECT_BASE: &str = "SELECT b.id, b.name, b.description, b.card_size, b.position, b.created_at, b.updated_at, \
    (SELECT COUNT(*) FROM tracker_tasks t WHERE t.board_id = b.id AND t.archived = 0) AS task_count \
    FROM tracker_boards b";

fn map_row(row: &Row) -> rusqlite::Result<Board> {
    Ok(Board {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        card_size: row.get("card_size")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        task_count: row.get("task_count")?,
    })
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<Board>> {
    let sql = format!("{SELECT_BASE} ORDER BY b.position ASC, b.created_at ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Board>> {
    let sql = format!("{SELECT_BASE} WHERE b.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn exists(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row("SELECT 1 FROM tracker_boards WHERE id = ?1", params![id], |_| Ok(()))
        .optional()
        .map(|r| r.is_some())
}

pub fn next_position(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_boards", [], |r| r.get(0))
}

pub fn create(conn: &Connection, id: &str, name: &str, description: Option<&str>, now: &str) -> rusqlite::Result<()> {
    let position = next_position(conn)?;
    conn.execute(
        "INSERT INTO tracker_boards (id, name, description, card_size, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 'normal', ?4, ?5, ?5)",
        params![id, name, description, position, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, description: Option<&str>, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_boards SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, name, description, now],
    )
}

pub fn set_card_size(conn: &Connection, id: &str, card_size: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_boards SET card_size = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, card_size, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_boards SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_boards WHERE id = ?1", params![id])
}
