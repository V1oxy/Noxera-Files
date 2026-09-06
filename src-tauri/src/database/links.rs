use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{Link, LinkFilter};

const SELECT_BASE: &str = "SELECT l.id, l.project_id, p.name AS project_name, l.group_id, g.name AS group_name, \
    l.title, l.url, l.description, l.position, l.created_at, l.updated_at \
    FROM links l \
    JOIN link_projects p ON p.id = l.project_id \
    LEFT JOIN link_groups g ON g.id = l.group_id";

struct RowWithSearchBlob {
    link: Link,
    blob: String,
}

fn map_row(row: &Row) -> rusqlite::Result<RowWithSearchBlob> {
    let link = Link {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        project_name: row.get("project_name")?,
        group_id: row.get("group_id")?,
        group_name: row.get("group_name")?,
        title: row.get("title")?,
        url: row.get("url")?,
        description: row.get("description")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    };
    let blob = format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}",
        link.title,
        link.url,
        link.description.as_deref().unwrap_or(""),
        link.project_name,
        link.group_name.as_deref().unwrap_or(""),
    );
    Ok(RowWithSearchBlob { link, blob })
}

/// Loads links (all projects, or one if `filter.project_id` is set) and
/// applies the search filter in Rust - mirrors `tracker_tasks::list_all`'s
/// reasoning: a single user's local link list is small enough that this is
/// simpler and safer than building dynamic SQL.
pub fn list(conn: &Connection, filter: &LinkFilter) -> rusqlite::Result<Vec<Link>> {
    let sql = format!("{SELECT_BASE} ORDER BY p.name COLLATE NOCASE ASC, g.position ASC, l.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<RowWithSearchBlob> = stmt.query_map([], map_row)?.collect::<rusqlite::Result<_>>()?;

    let term = filter.search.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(str::to_lowercase);
    Ok(rows
        .into_iter()
        .filter(|rw| {
            if let Some(project_id) = &filter.project_id {
                if rw.link.project_id != *project_id {
                    return false;
                }
            }
            if let Some(term) = &term {
                if !rw.blob.to_lowercase().contains(term) {
                    return false;
                }
            }
            true
        })
        .map(|rw| rw.link)
        .collect())
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Link>> {
    let sql = format!("{SELECT_BASE} WHERE l.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional().map(|r| r.map(|rw| rw.link))
}

pub fn next_position(conn: &Connection, project_id: &str, group_id: Option<&str>) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM links WHERE project_id = ?1 AND group_id IS ?2",
        params![project_id, group_id],
        |r| r.get(0),
    )
}

#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    project_id: &str,
    group_id: Option<&str>,
    title: &str,
    url: &str,
    description: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    let position = next_position(conn, project_id, group_id)?;
    conn.execute(
        "INSERT INTO links (id, project_id, group_id, title, url, description, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![id, project_id, group_id, title, url, description, position, now],
    )?;
    Ok(())
}

pub struct RawLinkColumns {
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub group_id: Option<String>,
}

fn get_raw(conn: &Connection, id: &str) -> rusqlite::Result<Option<RawLinkColumns>> {
    conn.query_row(
        "SELECT title, url, description, group_id FROM links WHERE id = ?1",
        params![id],
        |row| {
            Ok(RawLinkColumns {
                title: row.get(0)?,
                url: row.get(1)?,
                description: row.get(2)?,
                group_id: row.get(3)?,
            })
        },
    )
    .optional()
}

/// Applies a patch (fields left `None` keep their current value) and returns
/// the merged column values - `group_id` here is only ever the value a plain
/// rename/edit leaves it at; moving a link to a different group goes through
/// `set_group`/`set_position` below instead, same split as the tracker's
/// status vs. field updates.
pub fn apply_update(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    url: Option<&str>,
    description: Option<Option<&str>>,
    now: &str,
) -> rusqlite::Result<Option<RawLinkColumns>> {
    let existing = match get_raw(conn, id)? {
        Some(r) => r,
        None => return Ok(None),
    };
    let merged = RawLinkColumns {
        title: title.map(str::to_string).unwrap_or_else(|| existing.title.clone()),
        url: url.map(str::to_string).unwrap_or_else(|| existing.url.clone()),
        description: description.map(|d| d.map(str::to_string)).unwrap_or_else(|| existing.description.clone()),
        group_id: existing.group_id.clone(),
    };
    conn.execute(
        "UPDATE links SET title = ?2, url = ?3, description = ?4, updated_at = ?5 WHERE id = ?1",
        params![id, merged.title, merged.url, merged.description, now],
    )?;
    Ok(Some(merged))
}

pub fn set_group(conn: &Connection, id: &str, group_id: Option<&str>) -> rusqlite::Result<usize> {
    conn.execute("UPDATE links SET group_id = ?2 WHERE id = ?1", params![id, group_id])
}

pub fn set_position(conn: &Connection, id: &str, position: i64) -> rusqlite::Result<usize> {
    conn.execute("UPDATE links SET position = ?2 WHERE id = ?1", params![id, position])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM links WHERE id = ?1", params![id])
}
