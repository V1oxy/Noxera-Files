use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::FileVersion;

fn map_row(row: &Row) -> rusqlite::Result<FileVersion> {
    Ok(FileVersion {
        id: row.get("id")?,
        file_id: row.get("file_id")?,
        version_number: row.get("version_number")?,
        storage_path: row.get("storage_path")?,
        original_filename: row.get("original_filename")?,
        file_size: row.get("file_size")?,
        mime_type: row.get("mime_type")?,
        checksum: row.get("checksum")?,
        description: row.get("description")?,
        created_at: row.get("created_at")?,
    })
}

pub fn list_for_file(conn: &Connection, file_id: &str) -> rusqlite::Result<Vec<FileVersion>> {
    let mut stmt = conn.prepare(
        "SELECT id, file_id, version_number, storage_path, original_filename, file_size, \
         mime_type, checksum, description, created_at \
         FROM file_versions WHERE file_id = ?1 ORDER BY version_number DESC",
    )?;
    let rows = stmt.query_map(params![file_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, version_id: &str) -> rusqlite::Result<Option<FileVersion>> {
    conn.query_row(
        "SELECT id, file_id, version_number, storage_path, original_filename, file_size, \
         mime_type, checksum, description, created_at \
         FROM file_versions WHERE id = ?1",
        params![version_id],
        map_row,
    )
    .optional()
}

#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    file_id: &str,
    version_number: i64,
    storage_path: &str,
    original_filename: &str,
    file_size: i64,
    mime_type: Option<&str>,
    checksum: &str,
    description: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO file_versions \
         (id, file_id, version_number, storage_path, original_filename, file_size, mime_type, checksum, description, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            file_id,
            version_number,
            storage_path,
            original_filename,
            file_size,
            mime_type,
            checksum,
            description,
            now
        ],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, version_id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM file_versions WHERE id = ?1", params![version_id])
}

pub fn count_for_file(conn: &Connection, file_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM file_versions WHERE file_id = ?1",
        params![file_id],
        |r| r.get(0),
    )
}

/// The remaining version with the highest version_number, used to pick a new
/// `current_version_id` after the current one is deleted.
pub fn highest_remaining(conn: &Connection, file_id: &str) -> rusqlite::Result<Option<FileVersion>> {
    conn.query_row(
        "SELECT id, file_id, version_number, storage_path, original_filename, file_size, \
         mime_type, checksum, description, created_at \
         FROM file_versions WHERE file_id = ?1 ORDER BY version_number DESC LIMIT 1",
        params![file_id],
        map_row,
    )
    .optional()
}
