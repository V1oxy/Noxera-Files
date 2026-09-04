use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{FileEntry, FileVersion, SortDirection, SortField};

const SELECT_BASE: &str = "SELECT \
    f.id, f.project_id, f.folder_id, f.name, f.current_version_id, f.next_version_number, f.position, f.created_at, f.updated_at, \
    (SELECT COUNT(*) FROM file_versions v WHERE v.file_id = f.id) AS version_count, \
    v.id AS v_id, v.file_id AS v_file_id, v.version_number AS v_version_number, \
    v.storage_path AS v_storage_path, v.original_filename AS v_original_filename, \
    v.file_size AS v_file_size, v.mime_type AS v_mime_type, v.checksum AS v_checksum, \
    v.description AS v_description, v.created_at AS v_created_at \
    FROM files f LEFT JOIN file_versions v ON v.id = f.current_version_id";

fn map_row(row: &Row) -> rusqlite::Result<FileEntry> {
    let current_version = match row.get::<_, Option<String>>("v_id")? {
        Some(id) => Some(FileVersion {
            id,
            file_id: row.get("v_file_id")?,
            version_number: row.get("v_version_number")?,
            storage_path: row.get("v_storage_path")?,
            original_filename: row.get("v_original_filename")?,
            file_size: row.get("v_file_size")?,
            mime_type: row.get("v_mime_type")?,
            checksum: row.get("v_checksum")?,
            description: row.get("v_description")?,
            created_at: row.get("v_created_at")?,
        }),
        None => None,
    };
    Ok(FileEntry {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        folder_id: row.get("folder_id")?,
        name: row.get("name")?,
        current_version_id: row.get("current_version_id")?,
        next_version_number: row.get("next_version_number")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        current_version,
        version_count: row.get("version_count")?,
    })
}

fn sort_clause(field: SortField, dir: SortDirection) -> &'static str {
    use SortDirection::*;
    use SortField::*;
    match (field, dir) {
        (Name, Asc) => "ORDER BY f.name COLLATE NOCASE ASC",
        (Name, Desc) => "ORDER BY f.name COLLATE NOCASE DESC",
        (LastModified, Asc) => "ORDER BY f.updated_at ASC",
        (LastModified, Desc) => "ORDER BY f.updated_at DESC",
        (Created, Asc) => "ORDER BY f.created_at ASC",
        (Created, Desc) => "ORDER BY f.created_at DESC",
        (Size, Asc) => "ORDER BY v.file_size ASC",
        (Size, Desc) => "ORDER BY v.file_size DESC",
        (Custom, Asc) => "ORDER BY f.position ASC",
        (Custom, Desc) => "ORDER BY f.position DESC",
    }
}

/// Lists files in a project. When `search` is non-empty, it matches by name
/// across the *entire* project regardless of folder (so you don't have to
/// know which folder a file is in to find it); otherwise the list is scoped
/// to `folder_id` (`None` = the project's root).
pub fn list_for_project(
    conn: &Connection,
    project_id: &str,
    folder_id: Option<&str>,
    search: Option<&str>,
    field: SortField,
    dir: SortDirection,
) -> rusqlite::Result<Vec<FileEntry>> {
    let order = sort_clause(field, dir);
    if let Some(term) = search.filter(|s| !s.trim().is_empty()) {
        // SQLite's LIKE/NOCASE only case-folds ASCII, so a SQL-side filter
        // would miss e.g. "спам" matching "СПАМ". Fetch every file in the
        // project and filter here with Rust's Unicode-aware to_lowercase().
        let needle = term.trim().to_lowercase();
        let sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 {order}");
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params![project_id], map_row)?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map(|files| {
                files
                    .into_iter()
                    .filter(|f| f.name.to_lowercase().contains(&needle))
                    .collect()
            });
    }
    match folder_id {
        Some(folder) => {
            let sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.folder_id = ?2 {order}");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![project_id, folder], map_row)?;
            rows.collect()
        }
        None => {
            let sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.folder_id IS NULL {order}");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![project_id], map_row)?;
            rows.collect()
        }
    }
}

/// Matches by name across every project's files at once, newest-modified
/// first. Same Unicode-aware, fetch-then-filter approach as the per-project
/// search above and for the same reason (SQLite's NOCASE only folds ASCII).
/// Two queries (all files, then a project id -> name map) rather than a
/// join, so this can reuse SELECT_BASE/map_row as-is instead of forking a
/// second copy of that column list.
pub fn search_all_projects(conn: &Connection, search: &str) -> rusqlite::Result<Vec<(FileEntry, String)>> {
    let needle = search.trim().to_lowercase();
    let sql = format!("{SELECT_BASE} ORDER BY f.updated_at DESC");
    let mut stmt = conn.prepare(&sql)?;
    let files = stmt
        .query_map([], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut names_stmt = conn.prepare("SELECT id, name FROM projects")?;
    let project_names: std::collections::HashMap<String, String> = names_stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<_>>()?;

    Ok(files
        .into_iter()
        .filter(|f| f.name.to_lowercase().contains(&needle))
        .filter_map(|f| {
            let project_name = project_names.get(&f.project_id)?.clone();
            Some((f, project_name))
        })
        .collect())
}

pub fn get(conn: &Connection, file_id: &str) -> rusqlite::Result<Option<FileEntry>> {
    let sql = format!("{SELECT_BASE} WHERE f.id = ?1");
    conn.query_row(&sql, params![file_id], map_row).optional()
}

pub fn create(
    conn: &Connection,
    id: &str,
    project_id: &str,
    folder_id: Option<&str>,
    name: &str,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, project_id, folder_id)?;
    conn.execute(
        "INSERT INTO files (id, project_id, folder_id, name, current_version_id, next_version_number, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, NULL, 1, ?5, ?6, ?6)",
        params![id, project_id, folder_id, name, position, now],
    )?;
    Ok(())
}

/// Next free position among siblings in the same project + folder scope
/// (None = the project's root).
pub fn next_position(conn: &Connection, project_id: &str, folder_id: Option<&str>) -> rusqlite::Result<i64> {
    match folder_id {
        Some(folder) => conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM files WHERE project_id = ?1 AND folder_id = ?2",
            params![project_id, folder],
            |r| r.get(0),
        ),
        None => conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM files WHERE project_id = ?1 AND folder_id IS NULL",
            params![project_id],
            |r| r.get(0),
        ),
    }
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE files SET position = ?2 WHERE id = ?1", params![id, position])
}

/// Moves a file into a different folder (None = the project's root),
/// placing it at the end of that folder's list.
pub fn set_folder(
    conn: &Connection,
    id: &str,
    folder_id: Option<&str>,
    position: i64,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE files SET folder_id = ?2, position = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, folder_id, position, now],
    )
}

pub fn rename(conn: &Connection, id: &str, new_name: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE files SET name = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, new_name, now],
    )
}

pub fn set_current_version(
    conn: &Connection,
    id: &str,
    version_id: Option<&str>,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE files SET current_version_id = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, version_id, now],
    )
}

pub fn next_version_number(conn: &Connection, file_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT next_version_number FROM files WHERE id = ?1",
        params![file_id],
        |r| r.get(0),
    )
}

pub fn bump_next_version_number(conn: &Connection, file_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE files SET next_version_number = next_version_number + 1 WHERE id = ?1",
        params![file_id],
    )
}

/// Called after deleting a version and shifting every later version down by
/// one, so the next upload continues right after the new highest version
/// number instead of leaving a gap.
pub fn decrement_next_version_number(conn: &Connection, file_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE files SET next_version_number = next_version_number - 1 \
         WHERE id = ?1 AND next_version_number > 1",
        params![file_id],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM files WHERE id = ?1", params![id])
}
