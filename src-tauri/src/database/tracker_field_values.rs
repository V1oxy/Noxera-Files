use rusqlite::{params, Connection, Row};

use crate::models::FieldValue;

fn map_row(row: &Row) -> rusqlite::Result<FieldValue> {
    Ok(FieldValue {
        field_id: row.get("field_id")?,
        value: row.get("value")?,
    })
}

pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<FieldValue>> {
    let mut stmt = conn.prepare("SELECT field_id, value FROM tracker_field_values WHERE task_id = ?1")?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    rows.collect()
}

/// Replaces every field value for a task in one go - simpler and safe for a
/// board's small, human-sized set of custom fields, and matches how the
/// frontend always submits the whole field-value list together.
pub fn set_for_task(conn: &Connection, task_id: &str, values: &[FieldValue]) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM tracker_field_values WHERE task_id = ?1", params![task_id])?;
    for fv in values {
        if fv.value.is_none() {
            continue;
        }
        conn.execute(
            "INSERT INTO tracker_field_values (task_id, field_id, value) VALUES (?1, ?2, ?3)",
            params![task_id, fv.field_id, fv.value],
        )?;
    }
    Ok(())
}
