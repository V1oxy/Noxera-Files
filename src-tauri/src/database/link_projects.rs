use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::LinkProject;

const SELECT_BASE: &str = "SELECT p.id, p.name, p.position, p.created_at, p.updated_at, \
    (SELECT COUNT(*) FROM links l WHERE l.project_id = p.id) AS link_count \
    FROM link_projects p";

fn map_row(row: &Row) -> rusqlite::Result<LinkProject> {
    Ok(LinkProject {
        id: row.get("id")?,
        name: row.get("name")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        link_count: row.get("link_count")?,
    })
}

pub fn list_all(conn: &Connection) -> rusqlite::Result<Vec<LinkProject>> {
    let sql = format!("{SELECT_BASE} ORDER BY p.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<LinkProject>> {
    let sql = format!("{SELECT_BASE} WHERE p.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn exists(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM link_projects WHERE id = ?1)",
        params![id],
        |r| r.get(0),
    )
}

fn next_position(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM link_projects", [], |r| r.get(0))
}

pub fn create(conn: &Connection, id: &str, name: &str, now: &str) -> rusqlite::Result<()> {
    let position = next_position(conn)?;
    conn.execute(
        "INSERT INTO link_projects (id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, name, position, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE link_projects SET name = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, name, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE link_projects SET position = ?2 WHERE id = ?1", params![id, position])
}

/// Cascades (`ON DELETE CASCADE`) to every group and link inside it - unlike
/// deleting a single group, deleting the whole project is meant to take its
/// contents with it.
pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM link_projects WHERE id = ?1", params![id])
}
