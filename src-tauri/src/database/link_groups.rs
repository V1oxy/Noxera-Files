use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::LinkGroup;

const SELECT_BASE: &str = "SELECT g.id, g.project_id, g.name, g.position, g.created_at, g.updated_at, \
    (SELECT COUNT(*) FROM links l WHERE l.group_id = g.id) AS link_count \
    FROM link_groups g";

fn map_row(row: &Row) -> rusqlite::Result<LinkGroup> {
    Ok(LinkGroup {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        name: row.get("name")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        link_count: row.get("link_count")?,
    })
}

pub fn list_for_project(conn: &Connection, project_id: &str) -> rusqlite::Result<Vec<LinkGroup>> {
    let sql = format!("{SELECT_BASE} WHERE g.project_id = ?1 ORDER BY g.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![project_id], map_row)?;
    rows.collect()
}

/// Every group across every project, used to resolve `groupName` for the
/// cross-project "All" links view without one query per project.
pub fn list_all(conn: &Connection) -> rusqlite::Result<Vec<LinkGroup>> {
    let sql = format!("{SELECT_BASE} ORDER BY g.project_id, g.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<LinkGroup>> {
    let sql = format!("{SELECT_BASE} WHERE g.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

pub fn next_position(conn: &Connection, project_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM link_groups WHERE project_id = ?1",
        params![project_id],
        |r| r.get(0),
    )
}

pub fn create(conn: &Connection, id: &str, project_id: &str, name: &str, now: &str) -> rusqlite::Result<()> {
    let position = next_position(conn, project_id)?;
    conn.execute(
        "INSERT INTO link_groups (id, project_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, project_id, name, position, now],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, id: &str, name: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE link_groups SET name = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, name, now],
    )
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE link_groups SET position = ?2 WHERE id = ?1", params![id, position])
}

/// Never deletes the links inside it - `group_id` is `ON DELETE SET NULL`,
/// so they simply become ungrouped (spec: groups are purely organizational).
pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM link_groups WHERE id = ?1", params![id])
}
