use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::Project;

fn map_row(row: &Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        file_count: row.get("file_count")?,
    })
}

const SELECT_BASE: &str = "SELECT p.id, p.name, p.description, p.position, p.created_at, p.updated_at, \
    (SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) AS file_count \
    FROM projects p";

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<Project>> {
    let sql = format!("{SELECT_BASE} ORDER BY p.position ASC, p.updated_at DESC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

/// Next free position at the end of the project list, so a brand-new
/// project always lands last instead of colliding with position 0.
pub fn next_position(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM projects", [], |r| r.get(0))
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE projects SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Project>> {
    let sql = format!("{SELECT_BASE} WHERE p.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn create(
    conn: &Connection,
    id: &str,
    name: &str,
    description: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn)?;
    conn.execute(
        "INSERT INTO projects (id, name, description, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, name, description, position, now],
    )?;
    Ok(())
}

pub fn update(
    conn: &Connection,
    id: &str,
    name: &str,
    description: Option<&str>,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE projects SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, name, description, now],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
}

pub fn exists(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT 1 FROM projects WHERE id = ?1",
        params![id],
        |_| Ok(()),
    )
    .optional()
    .map(|r| r.is_some())
}
