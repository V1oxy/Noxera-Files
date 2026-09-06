use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::TaskLocalFile;

const SELECT_BASE: &str = "SELECT id, task_id, file_name, file_size, mime_type, added_at FROM tracker_task_local_files";

fn map_row(row: &Row) -> rusqlite::Result<TaskLocalFile> {
    Ok(TaskLocalFile {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        file_name: row.get("file_name")?,
        file_size: row.get("file_size")?,
        mime_type: row.get("mime_type")?,
        added_at: row.get("added_at")?,
    })
}

pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<TaskLocalFile>> {
    let sql = format!("{SELECT_BASE} WHERE task_id = ?1 ORDER BY position ASC, added_at ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    rows.collect()
}

/// Row shape needed to remove the physical file alongside the DB row -
/// `get_for_delete` returns the storage path too, which the public `get`
/// (used only to display metadata) deliberately never exposes.
pub struct LocalFileWithPath {
    pub file: TaskLocalFile,
    pub storage_path: String,
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<LocalFileWithPath>> {
    conn.query_row(
        "SELECT id, task_id, file_name, file_size, mime_type, added_at, storage_path \
         FROM tracker_task_local_files WHERE id = ?1",
        params![id],
        |row| {
            Ok(LocalFileWithPath {
                file: map_row(row)?,
                storage_path: row.get("storage_path")?,
            })
        },
    )
    .optional()
}

#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    task_id: &str,
    file_name: &str,
    storage_path: &str,
    file_size: i64,
    mime_type: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tracker_task_local_files \
         (id, task_id, file_name, storage_path, file_size, mime_type, position, added_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, \
         (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_task_local_files WHERE task_id = ?2), ?7)",
        params![id, task_id, file_name, storage_path, file_size, mime_type, now],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_task_local_files WHERE id = ?1", params![id])
}
