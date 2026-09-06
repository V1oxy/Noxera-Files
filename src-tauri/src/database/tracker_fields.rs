use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{Field, FieldType};

fn map_row(row: &Row) -> rusqlite::Result<Field> {
    let field_type: String = row.get("field_type")?;
    let options_json: Option<String> = row.get("options")?;
    let options = options_json
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default();
    Ok(Field {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        name: row.get("name")?,
        field_type: FieldType::parse(&field_type),
        options,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_BASE: &str = "SELECT id, board_id, name, field_type, options, position, created_at, updated_at FROM tracker_fields";

pub fn list_for_board(conn: &Connection, board_id: &str) -> rusqlite::Result<Vec<Field>> {
    let sql = format!("{SELECT_BASE} WHERE board_id = ?1 ORDER BY position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![board_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Field>> {
    let sql = format!("{SELECT_BASE} WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn next_position(conn: &Connection, board_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_fields WHERE board_id = ?1",
        params![board_id],
        |r| r.get(0),
    )
}

pub fn create(
    conn: &Connection,
    id: &str,
    board_id: &str,
    name: &str,
    field_type: FieldType,
    options: &[String],
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, board_id)?;
    let options_json = serde_json::to_string(options).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO tracker_fields (id, board_id, name, field_type, options, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![id, board_id, name, field_type.as_str(), options_json, position, now],
    )?;
    Ok(())
}

pub fn update(
    conn: &Connection,
    id: &str,
    name: &str,
    field_type: FieldType,
    options: &[String],
    now: &str,
) -> rusqlite::Result<usize> {
    let options_json = serde_json::to_string(options).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE tracker_fields SET name = ?2, field_type = ?3, options = ?4, updated_at = ?5 WHERE id = ?1",
        params![id, name, field_type.as_str(), options_json, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_fields SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_fields WHERE id = ?1", params![id])
}
