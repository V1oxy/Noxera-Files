use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::Label;

const SELECT_BASE: &str = "SELECT id, board_id, name, color, position, created_at FROM tracker_labels";

fn map_row(row: &Row) -> rusqlite::Result<Label> {
    Ok(Label {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
    })
}

pub fn list_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Vec<Label>> {
    let sql = format!("{SELECT_BASE} WHERE board_id = ?1 ORDER BY position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Label>> {
    let sql = format!("{SELECT_BASE} WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn next_position(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_labels WHERE board_id = ?1",
        params![board_id],
        |r| r.get(0),
    )
}

pub fn create(conn: &Connection, id: &str, board_id: &str, name: &str, color: &str, now: &str) -> rusqlite::Result<()> {
    let position = next_position(conn, board_id)?;
    conn.execute(
        "INSERT INTO tracker_labels (id, board_id, name, color, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, board_id, name, color, position, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, color: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_labels SET name = ?2, color = ?3 WHERE id = ?1",
        params![id, name, color],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_labels SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_labels WHERE id = ?1", params![id])
}

pub fn set_for_task(conn: &Connection, task_id: &str, label_ids: &[String]) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM tracker_task_labels WHERE task_id = ?1", params![task_id])?;
    for label_id in label_ids {
        conn.execute(
            "INSERT OR IGNORE INTO tracker_task_labels (task_id, label_id) VALUES (?1, ?2)",
            params![task_id, label_id],
        )?;
    }
    Ok(())
}
