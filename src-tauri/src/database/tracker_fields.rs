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
        default_value: row.get("default_value")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const SELECT_BASE: &str = "SELECT id, board_id, name, field_type, options, default_value, position, created_at, updated_at FROM tracker_fields";

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

#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    board_id: &str,
    name: &str,
    field_type: FieldType,
    options: &[String],
    default_value: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, board_id)?;
    let options_json = serde_json::to_string(options).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO tracker_fields (id, board_id, name, field_type, options, default_value, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![id, board_id, name, field_type.as_str(), options_json, default_value, position, now],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update(
    conn: &Connection,
    id: &str,
    name: &str,
    field_type: FieldType,
    options: &[String],
    default_value: Option<&str>,
    now: &str,
) -> rusqlite::Result<usize> {
    let options_json = serde_json::to_string(options).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE tracker_fields SET name = ?2, field_type = ?3, options = ?4, default_value = ?5, updated_at = ?6 WHERE id = ?1",
        params![id, name, field_type.as_str(), options_json, default_value, now],
    )
}

/// Renames every stored value equal to `old_option` (for a select field) to
/// `new_option`, and remaps the field's own default value the same way -
/// used when an option is renamed from board settings so tasks that already
/// hold the old option text stay consistent (spec section 2: "корректная
/// обработка уже сохранённых значений").
pub fn rename_option_value(conn: &Connection, field_id: &str, old_option: &str, new_option: &str) -> rusqlite::Result<usize> {
    let n = conn.execute(
        "UPDATE tracker_field_values SET value = ?3 WHERE field_id = ?1 AND value = ?2",
        params![field_id, old_option, new_option],
    )?;
    conn.execute(
        "UPDATE tracker_fields SET default_value = ?3 WHERE id = ?1 AND default_value = ?2",
        params![field_id, old_option, new_option],
    )?;
    Ok(n)
}

/// Clears every stored value pointing at an option that's being removed
/// entirely (rather than renamed), so tasks never end up displaying a value
/// that isn't among the field's options any more.
pub fn clear_option_values(conn: &Connection, field_id: &str, removed_option: &str) -> rusqlite::Result<usize> {
    // Deleted, not nulled - `tracker_field_values` only ever holds rows with
    // a real value (see `set_for_task`), so clearing one means removing the
    // row entirely, matching that invariant.
    let n = conn.execute(
        "DELETE FROM tracker_field_values WHERE field_id = ?1 AND value = ?2",
        params![field_id, removed_option],
    )?;
    conn.execute(
        "UPDATE tracker_fields SET default_value = NULL WHERE id = ?1 AND default_value = ?2",
        params![field_id, removed_option],
    )?;
    Ok(n)
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE tracker_fields SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_fields WHERE id = ?1", params![id])
}
