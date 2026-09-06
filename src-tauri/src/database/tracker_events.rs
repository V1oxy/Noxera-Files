use rusqlite::{params, Connection, Row};
use serde::Serialize;

use crate::models::TaskEvent;
use crate::utils::id::new_id;

fn map_row(row: &Row) -> rusqlite::Result<TaskEvent> {
    let payload_raw: Option<String> = row.get("payload")?;
    let payload = payload_raw.and_then(|s| serde_json::from_str(&s).ok());
    Ok(TaskEvent {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        kind: row.get("kind")?,
        payload,
        author: row.get("author")?,
        created_at: row.get("created_at")?,
    })
}

pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<TaskEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, task_id, kind, payload, author, created_at FROM tracker_task_events \
         WHERE task_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    rows.collect()
}

/// Appends one history entry. `payload` is serialized to JSON - pass `&()` or
/// any small serializable struct describing what changed; every event kind's
/// shape is documented next to where it's logged in `commands/tracker_tasks.rs`.
pub fn log(
    conn: &Connection,
    task_id: &str,
    kind: &str,
    payload: &impl Serialize,
    author: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    let payload_json = serde_json::to_string(payload).ok();
    conn.execute(
        "INSERT INTO tracker_task_events (id, task_id, kind, payload, author, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![new_id(), task_id, kind, payload_json, author, now],
    )?;
    Ok(())
}
