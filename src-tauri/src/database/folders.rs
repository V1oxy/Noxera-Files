use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{Folder, FolderPathEntry};

const SELECT_BASE: &str = "SELECT \
    f.id, f.project_id, f.parent_folder_id, f.name, f.created_at, f.updated_at, \
    (SELECT COUNT(*) FROM folders sf WHERE sf.parent_folder_id = f.id) AS folder_count, \
    (SELECT COUNT(*) FROM files ff WHERE ff.folder_id = f.id) AS file_count \
    FROM folders f";

fn map_row(row: &Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        parent_folder_id: row.get("parent_folder_id")?,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        folder_count: row.get("folder_count")?,
        file_count: row.get("file_count")?,
    })
}

/// Direct child folders of `parent_folder_id` (None = the project's root).
pub fn list_children(
    conn: &Connection,
    project_id: &str,
    parent_folder_id: Option<&str>,
) -> rusqlite::Result<Vec<Folder>> {
    let sql;
    let mut stmt;
    let rows = match parent_folder_id {
        Some(parent) => {
            sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.parent_folder_id = ?2 ORDER BY f.name COLLATE NOCASE ASC");
            stmt = conn.prepare(&sql)?;
            stmt.query_map(params![project_id, parent], map_row)?
                .collect::<rusqlite::Result<Vec<_>>>()
        }
        None => {
            sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.parent_folder_id IS NULL ORDER BY f.name COLLATE NOCASE ASC");
            stmt = conn.prepare(&sql)?;
            stmt.query_map(params![project_id], map_row)?
                .collect::<rusqlite::Result<Vec<_>>>()
        }
    };
    rows
}

pub fn get(conn: &Connection, folder_id: &str) -> rusqlite::Result<Option<Folder>> {
    let sql = format!("{SELECT_BASE} WHERE f.id = ?1");
    conn.query_row(&sql, params![folder_id], map_row).optional()
}

pub fn create(
    conn: &Connection,
    id: &str,
    project_id: &str,
    parent_folder_id: Option<&str>,
    name: &str,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO folders (id, project_id, parent_folder_id, name, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, project_id, parent_folder_id, name, now],
    )?;
    Ok(())
}

pub fn rename(conn: &Connection, id: &str, name: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE folders SET name = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, name, now],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
}

/// Direct child file ids of a folder (used when recursively deleting one).
pub fn file_ids_in(conn: &Connection, folder_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT id FROM files WHERE folder_id = ?1")?;
    let rows = stmt.query_map(params![folder_id], |r| r.get(0))?;
    rows.collect()
}

/// Direct child folder ids of a folder.
pub fn subfolder_ids(conn: &Connection, folder_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT id FROM folders WHERE parent_folder_id = ?1")?;
    let rows = stmt.query_map(params![folder_id], |r| r.get(0))?;
    rows.collect()
}

/// Root-to-leaf breadcrumb for `folder_id`, walking parent_folder_id upward.
pub fn path(conn: &Connection, folder_id: &str) -> rusqlite::Result<Vec<FolderPathEntry>> {
    let mut entries = Vec::new();
    let mut current = Some(folder_id.to_string());
    // Defensively cap the walk in case of any (should-be-impossible) cycle.
    for _ in 0..256 {
        let Some(id) = current.take() else { break };
        let row: Option<(String, String, Option<String>)> = conn
            .query_row(
                "SELECT id, name, parent_folder_id FROM folders WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        let Some((id, name, parent)) = row else { break };
        entries.push(FolderPathEntry { id, name });
        current = parent;
    }
    entries.reverse();
    Ok(entries)
}
