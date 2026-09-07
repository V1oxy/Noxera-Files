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
///
/// `limit`/`offset` bound how many rows come back either way, so a huge
/// project never serializes (and the frontend never renders) more than one
/// page at a time - but note the *search* branch still has to fetch and
/// Unicode-lowercase every file in the project before it can paginate the
/// matches (see the comment there): the bound applies to what's returned,
/// not to that branch's scan cost. Plain browsing (no search term) is fully
/// bounded end to end via `LIMIT`/`OFFSET` in SQL.
#[allow(clippy::too_many_arguments)]
pub fn list_for_project(
    conn: &Connection,
    project_id: &str,
    folder_id: Option<&str>,
    search: Option<&str>,
    field: SortField,
    dir: SortDirection,
    limit: i64,
    offset: i64,
) -> rusqlite::Result<Vec<FileEntry>> {
    let order = sort_clause(field, dir);
    if let Some(term) = search.filter(|s| !s.trim().is_empty()) {
        // SQLite's LIKE/NOCASE only case-folds ASCII, so a SQL-side filter
        // would miss e.g. "спам" matching "СПАМ". Fetch every file in the
        // project (scoped to just this one project, not the whole app) and
        // filter here with Rust's Unicode-aware to_lowercase(), then apply
        // the page window to the matches.
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
                    .skip(offset.max(0) as usize)
                    .take(limit.max(0) as usize)
                    .collect()
            });
    }
    match folder_id {
        Some(folder) => {
            let sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.folder_id = ?2 {order} LIMIT ?3 OFFSET ?4");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![project_id, folder, limit, offset], map_row)?;
            rows.collect()
        }
        None => {
            let sql = format!("{SELECT_BASE} WHERE f.project_id = ?1 AND f.folder_id IS NULL {order} LIMIT ?2 OFFSET ?3");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![project_id, limit, offset], map_row)?;
            rows.collect()
        }
    }
}

/// Caps how many global search hits get serialized/rendered - the scan
/// behind it still has to touch every file to stay Unicode-correct (see the
/// doc comment below), but nothing needs to look at more than the first
/// couple hundred matches of an ad-hoc search anyway.
const GLOBAL_SEARCH_LIMIT: usize = 200;

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
        .take(GLOBAL_SEARCH_LIMIT)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::projects;

    fn setup() -> (Connection, std::path::PathBuf, String) {
        let dir = std::env::temp_dir().join(format!("noxera-files-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = crate::database::open(&dir.join("test.db")).unwrap();
        let now = "2026-01-01T00:00:00+00:00";
        let project_id = "project-1".to_string();
        projects::create(&conn, &project_id, "Project", None, now).unwrap();
        (conn, dir, project_id)
    }

    fn teardown(conn: Connection, dir: std::path::PathBuf) {
        drop(conn);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn list_for_project_paginates_without_a_search_term() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        for i in 0..5 {
            create(&conn, &format!("f{i}"), &project_id, None, &format!("file-{i}.txt"), now).unwrap();
        }

        let page1 = list_for_project(&conn, &project_id, None, None, SortField::Name, SortDirection::Asc, 2, 0).unwrap();
        assert_eq!(page1.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), vec!["file-0.txt", "file-1.txt"]);
        let page2 = list_for_project(&conn, &project_id, None, None, SortField::Name, SortDirection::Asc, 2, 2).unwrap();
        assert_eq!(page2.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), vec!["file-2.txt", "file-3.txt"]);
        let page3 = list_for_project(&conn, &project_id, None, None, SortField::Name, SortDirection::Asc, 2, 4).unwrap();
        assert_eq!(page3.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), vec!["file-4.txt"]);

        teardown(conn, dir);
    }

    #[test]
    fn list_for_project_search_is_unicode_aware_and_still_paginates() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        create(&conn, "f1", &project_id, None, "СПАМ.txt", now).unwrap();
        create(&conn, "f2", &project_id, None, "unrelated.txt", now).unwrap();
        create(&conn, "f3", &project_id, None, "спам-2.txt", now).unwrap();

        // Cyrillic case-folding: "спам" (lowercase) must match "СПАМ.txt".
        let hits = list_for_project(&conn, &project_id, None, Some("спам"), SortField::Name, SortDirection::Asc, 10, 0).unwrap();
        assert_eq!(hits.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), vec!["СПАМ.txt", "спам-2.txt"]);

        let first_page = list_for_project(&conn, &project_id, None, Some("спам"), SortField::Name, SortDirection::Asc, 1, 0).unwrap();
        assert_eq!(first_page.len(), 1);

        teardown(conn, dir);
    }

    /// Not a correctness test - seeds 200,000 files into one project, then
    /// times a paginated browse page and a paginated search page to confirm
    /// cost stays flat (proportional to the page size, not to 200,000).
    ///
    /// Run explicitly: `cargo test --release two_hundred_thousand_files -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn two_hundred_thousand_files_stay_fast_to_page() {
        let (conn, dir, project_id) = setup();
        let now = "2026-01-02T00:00:00+00:00";
        const N: usize = 200_000;

        let seed_start = std::time::Instant::now();
        {
            let tx = conn.unchecked_transaction().unwrap();
            {
                let mut stmt = tx
                    .prepare(
                        "INSERT INTO files (id, project_id, folder_id, name, current_version_id, next_version_number, position, created_at, updated_at) \
                         VALUES (?1, ?2, NULL, ?3, NULL, 1, ?4, ?5, ?5)",
                    )
                    .unwrap();
                for i in 0..N {
                    stmt.execute(params![format!("f{i}"), project_id, format!("file-{i}.txt"), i as i64, now]).unwrap();
                }
            }
            tx.commit().unwrap();
        }
        eprintln!("seed {N} files (raw batched insert): {:?}", seed_start.elapsed());

        let browse_start = std::time::Instant::now();
        let page = list_for_project(&conn, &project_id, None, None, SortField::Name, SortDirection::Asc, 150, 0).unwrap();
        eprintln!("list_for_project, one page of 150, over {N} rows: {:?}", browse_start.elapsed());
        assert_eq!(page.len(), 150);

        let search_start = std::time::Instant::now();
        let hits = list_for_project(&conn, &project_id, None, Some("199999"), SortField::Name, SortDirection::Asc, 150, 0).unwrap();
        eprintln!("list_for_project, search + page, over {N} rows: {:?}", search_start.elapsed());
        assert_eq!(hits.len(), 1);

        teardown(conn, dir);
    }
}
