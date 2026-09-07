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

const ORDER_BY: &str = "ORDER BY p.name COLLATE NOCASE ASC, g.position ASC, l.position ASC";

/// Loads links (all projects, or one if `filter.project_id` is set),
/// bounded to `limit` rows starting at `offset` either way, so a huge link
/// collection never serializes/renders more than one page at a time.
///
/// Without a search term, `project_id` and the page window are pushed into
/// SQL - fully bounded end to end regardless of total link count. *With* a
/// search term, this still has to fetch and Unicode-lowercase every link in
/// scope before it can paginate the matches (`LOWER()`/`NOCASE` in SQLite
/// only case-folds ASCII, same reasoning as `files::list_for_project`'s
/// search branch) - the page window still bounds what comes back, just not
/// that branch's scan cost.
pub fn list(conn: &Connection, filter: &LinkFilter, limit: i64, offset: i64) -> rusqlite::Result<Vec<Link>> {
    let term = filter.search.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(str::to_lowercase);

    if term.is_none() {
        return match &filter.project_id {
            Some(project_id) => {
                let sql = format!("{SELECT_BASE} WHERE l.project_id = ?1 {ORDER_BY} LIMIT ?2 OFFSET ?3");
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![project_id, limit, offset], map_row)?;
                rows.map(|r| r.map(|rw| rw.link)).collect()
            }
            None => {
                let sql = format!("{SELECT_BASE} {ORDER_BY} LIMIT ?1 OFFSET ?2");
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![limit, offset], map_row)?;
                rows.map(|r| r.map(|rw| rw.link)).collect()
            }
        };
    }

    let sql = match &filter.project_id {
        Some(_) => format!("{SELECT_BASE} WHERE l.project_id = ?1 {ORDER_BY}"),
        None => format!("{SELECT_BASE} {ORDER_BY}"),
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<RowWithSearchBlob> = match &filter.project_id {
        Some(project_id) => stmt.query_map(params![project_id], map_row)?.collect::<rusqlite::Result<_>>()?,
        None => stmt.query_map([], map_row)?.collect::<rusqlite::Result<_>>()?,
    };

    let term = term.unwrap();
    Ok(rows
        .into_iter()
        .filter(|rw| rw.blob.to_lowercase().contains(&term))
        .map(|rw| rw.link)
        .skip(offset.max(0) as usize)
        .take(limit.max(0) as usize)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::link_projects;

    fn setup() -> (Connection, std::path::PathBuf, String) {
        let dir = std::env::temp_dir().join(format!("noxera-links-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = crate::database::open(&dir.join("test.db")).unwrap();
        let now = "2026-01-01T00:00:00+00:00";
        let project_id = "link-project-1".to_string();
        link_projects::create(&conn, &project_id, "Project", now).unwrap();
        (conn, dir, project_id)
    }

    fn teardown(conn: Connection, dir: std::path::PathBuf) {
        drop(conn);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn list_paginates_without_a_search_term() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        for i in 0..5 {
            create(&conn, &format!("l{i}"), &project_id, None, &format!("Link {i}"), "https://example.com", None, now).unwrap();
        }

        let filter = LinkFilter { project_id: Some(project_id.clone()), ..Default::default() };
        let page1 = list(&conn, &filter, 2, 0).unwrap();
        assert_eq!(page1.iter().map(|l| l.title.as_str()).collect::<Vec<_>>(), vec!["Link 0", "Link 1"]);
        let page2 = list(&conn, &filter, 2, 2).unwrap();
        assert_eq!(page2.iter().map(|l| l.title.as_str()).collect::<Vec<_>>(), vec!["Link 2", "Link 3"]);
        let page3 = list(&conn, &filter, 2, 4).unwrap();
        assert_eq!(page3.iter().map(|l| l.title.as_str()).collect::<Vec<_>>(), vec!["Link 4"]);

        teardown(conn, dir);
    }

    #[test]
    fn list_search_matches_title_and_still_paginates() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&conn, "l1", &project_id, None, "Design docs", "https://a.example", None, now).unwrap();
        create(&conn, "l2", &project_id, None, "Unrelated", "https://b.example", None, now).unwrap();
        create(&conn, "l3", &project_id, None, "More design work", "https://c.example", None, now).unwrap();

        let filter = LinkFilter { search: Some("design".to_string()), ..Default::default() };
        let hits = list(&conn, &filter, 10, 0).unwrap();
        assert_eq!(hits.iter().map(|l| l.title.as_str()).collect::<Vec<_>>(), vec!["Design docs", "More design work"]);

        let first_page = list(&conn, &filter, 1, 0).unwrap();
        assert_eq!(first_page.len(), 1);

        teardown(conn, dir);
    }

    /// Not a correctness test - seeds 200,000 links into one project, then
    /// times a paginated browse page and a paginated search page to confirm
    /// cost stays flat (proportional to the page size, not to 200,000).
    ///
    /// Run explicitly: `cargo test --release two_hundred_thousand_links -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn two_hundred_thousand_links_stay_fast_to_page() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        const N: usize = 200_000;

        let seed_start = std::time::Instant::now();
        {
            let tx = conn.unchecked_transaction().unwrap();
            {
                let mut stmt = tx
                    .prepare(
                        "INSERT INTO links (id, project_id, group_id, title, url, description, position, created_at, updated_at) \
                         VALUES (?1, ?2, NULL, ?3, ?4, NULL, ?5, ?6, ?6)",
                    )
                    .unwrap();
                for i in 0..N {
                    stmt.execute(params![format!("l{i}"), project_id, format!("Link {i}"), "https://example.com", i as i64, now]).unwrap();
                }
            }
            tx.commit().unwrap();
        }
        eprintln!("seed {N} links (raw batched insert): {:?}", seed_start.elapsed());

        let filter = LinkFilter { project_id: Some(project_id.clone()), ..Default::default() };
        let browse_start = std::time::Instant::now();
        let page = list(&conn, &filter, 150, 0).unwrap();
        eprintln!("list, one page of 150, over {N} rows: {:?}", browse_start.elapsed());
        assert_eq!(page.len(), 150);

        let search_filter = LinkFilter { search: Some("199999".to_string()), ..Default::default() };
        let search_start = std::time::Instant::now();
        let hits = list(&conn, &search_filter, 150, 0).unwrap();
        eprintln!("list, search + page, over {N} rows: {:?}", search_start.elapsed());
        assert_eq!(hits.len(), 1);

        teardown(conn, dir);
    }
}
