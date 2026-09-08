use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::TaskLink;

const SELECT_BASE: &str = "SELECT tl.id, tl.task_id, tl.link_id, tl.cached_title, tl.cached_url, tl.added_at, \
    l.title AS live_title, l.url AS live_url \
    FROM tracker_task_links tl LEFT JOIN links l ON l.id = tl.link_id";

fn map_row(row: &Row) -> rusqlite::Result<TaskLink> {
    let link_id: Option<String> = row.get("link_id")?;
    let live_title: Option<String> = row.get("live_title")?;
    let live_url: Option<String> = row.get("live_url")?;
    let cached_title: String = row.get("cached_title")?;
    let cached_url: String = row.get("cached_url")?;
    // True unless this pointed at a real Links-section row that's since been
    // deleted - an ad-hoc link (no `link_id` at all) has nothing that could
    // go missing, so it's always "exists".
    let link_exists = link_id.is_none() || live_title.is_some();
    Ok(TaskLink {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        link_id,
        link_exists,
        title: live_title.unwrap_or(cached_title),
        url: live_url.unwrap_or(cached_url),
        added_at: row.get("added_at")?,
    })
}

pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<TaskLink>> {
    let sql = format!("{SELECT_BASE} WHERE tl.task_id = ?1 ORDER BY tl.position ASC, tl.added_at ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<TaskLink>> {
    let sql = format!("{SELECT_BASE} WHERE tl.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

/// Attaches an existing Links-section link - `cached_title`/`cached_url`
/// should be that link's current title/url at attach time, used only once
/// the live row is gone (see the table's doc comment).
pub fn attach(
    conn: &Connection,
    id: &str,
    task_id: &str,
    link_id: &str,
    cached_title: &str,
    cached_url: &str,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tracker_task_links (id, task_id, link_id, cached_title, cached_url, position, added_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_task_links WHERE task_id = ?2), ?6)",
        params![id, task_id, link_id, cached_title, cached_url, now],
    )?;
    Ok(())
}

/// Adds a plain URL never stored in the Links section (`link_id` stays NULL).
pub fn add_adhoc(conn: &Connection, id: &str, task_id: &str, title: &str, url: &str, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tracker_task_links (id, task_id, link_id, cached_title, cached_url, position, added_at) \
         VALUES (?1, ?2, NULL, ?3, ?4, (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_task_links WHERE task_id = ?2), ?5)",
        params![id, task_id, title, url, now],
    )?;
    Ok(())
}

pub fn detach(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_task_links WHERE id = ?1", params![id])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{link_projects, links, tracker_boards, tracker_priorities, tracker_statuses, tracker_tasks};

    struct Fixture {
        conn: Connection,
        dir: std::path::PathBuf,
        task_id: String,
    }

    fn setup() -> Fixture {
        let dir = std::env::temp_dir().join(format!("noxera-task-links-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = crate::database::open(&dir.join("test.db")).unwrap();
        let now = "2026-01-01T00:00:00+00:00";

        let board_id = "board-1".to_string();
        tracker_boards::create(&conn, &board_id, "Board", None, now).unwrap();
        let status_id = "status-1".to_string();
        tracker_statuses::create(&conn, &status_id, &board_id, "Todo", "#000", true, now).unwrap();
        let priority_id = "priority-1".to_string();
        tracker_priorities::create(&conn, &priority_id, &board_id, "Normal", "#000", true, now).unwrap();
        let task_id = "task-1".to_string();
        tracker_tasks::create(&conn, &task_id, &board_id, &status_id, "Task", None, None, None, &priority_id, "2026-01-01", now).unwrap();

        Fixture { conn, dir, task_id }
    }

    fn teardown(f: Fixture) {
        drop(f.conn);
        std::fs::remove_dir_all(&f.dir).ok();
    }

    #[test]
    fn attached_link_tracks_live_edits_and_falls_back_to_cache_once_deleted() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";

        let project_id = "link-project-1".to_string();
        link_projects::create(&f.conn, &project_id, "Bookmarks", now).unwrap();
        let link_id = "link-1".to_string();
        links::create(&f.conn, &link_id, &project_id, None, "Original title", "https://example.com/original", None, now).unwrap();

        let task_link_id = "tl-1".to_string();
        attach(&f.conn, &task_link_id, &f.task_id, &link_id, "Original title", "https://example.com/original", now).unwrap();

        let attached = get(&f.conn, &task_link_id).unwrap().unwrap();
        assert!(attached.link_exists);
        assert_eq!(attached.title, "Original title");
        assert_eq!(attached.url, "https://example.com/original");

        // Editing the live link elsewhere must be reflected here too - the
        // cached title/url are only a fallback for a deleted link.
        f.conn
            .execute("UPDATE links SET title = 'Renamed', url = 'https://example.com/renamed' WHERE id = ?1", params![link_id])
            .unwrap();
        let after_edit = get(&f.conn, &task_link_id).unwrap().unwrap();
        assert_eq!(after_edit.title, "Renamed");
        assert_eq!(after_edit.url, "https://example.com/renamed");

        // Deleting the link from the Links section must not remove the
        // task's attachment - it falls back to the cached (pre-edit) values.
        f.conn.execute("DELETE FROM links WHERE id = ?1", params![link_id]).unwrap();
        let after_delete = get(&f.conn, &task_link_id).unwrap().unwrap();
        assert!(!after_delete.link_exists);
        assert_eq!(after_delete.title, "Original title");
        assert_eq!(after_delete.url, "https://example.com/original");

        teardown(f);
    }

    #[test]
    fn adhoc_link_never_touches_the_links_section() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";

        let id = "tl-adhoc".to_string();
        add_adhoc(&f.conn, &id, &f.task_id, "Design doc", "https://docs.example.com/design", now).unwrap();

        let link = get(&f.conn, &id).unwrap().unwrap();
        assert!(link.link_id.is_none());
        assert!(link.link_exists);
        assert_eq!(link.title, "Design doc");
        assert_eq!(link.url, "https://docs.example.com/design");

        let listed = list_for_task(&f.conn, &f.task_id).unwrap();
        assert_eq!(listed.len(), 1);

        teardown(f);
    }
}
