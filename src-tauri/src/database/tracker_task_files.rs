use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;

use crate::models::TaskFile;

use super::tracker_events;

const SELECT_BASE: &str = "SELECT tf.id, tf.task_id, tf.file_id, tf.always_latest, tf.unseen_update, \
    tf.cached_file_name, tf.added_at, \
    f.name AS live_name, f.project_id AS file_project_id, f.folder_id AS file_folder_id, \
    p.name AS project_name, \
    v.id AS resolved_version_id, v.version_number AS version_number, v.created_at AS version_date, \
    v.file_size AS file_size, v.mime_type AS mime_type \
    FROM tracker_task_files tf \
    LEFT JOIN files f ON f.id = tf.file_id \
    LEFT JOIN projects p ON p.id = f.project_id \
    LEFT JOIN file_versions v ON v.id = (CASE WHEN tf.always_latest = 1 THEN f.current_version_id ELSE tf.version_id END)";

fn map_row(row: &Row) -> rusqlite::Result<TaskFile> {
    let live_name: Option<String> = row.get("live_name")?;
    let cached_file_name: String = row.get("cached_file_name")?;
    Ok(TaskFile {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        file_id: row.get("file_id")?,
        file_exists: live_name.is_some(),
        file_name: live_name.unwrap_or(cached_file_name),
        project_id: row.get("file_project_id")?,
        project_name: row.get("project_name")?,
        folder_id: row.get("file_folder_id")?,
        always_latest: row.get("always_latest")?,
        version_id: row.get("resolved_version_id")?,
        version_exists: row.get::<_, Option<String>>("resolved_version_id")?.is_some(),
        version_number: row.get("version_number")?,
        version_date: row.get("version_date")?,
        file_size: row.get("file_size")?,
        mime_type: row.get("mime_type")?,
        unseen_update: row.get("unseen_update")?,
        added_at: row.get("added_at")?,
    })
}

pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<TaskFile>> {
    let sql = format!("{SELECT_BASE} WHERE tf.task_id = ?1 ORDER BY tf.added_at ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<TaskFile>> {
    let sql = format!("{SELECT_BASE} WHERE tf.id = ?1");
    conn.query_row(&sql, params![id], map_row).optional()
}

/// `fixed_version_id` is the version this attachment pins to and should be
/// `None` whenever `always_latest` is true (the resolved-version query
/// ignores it in that mode anyway, but keeping it unset avoids a stale value
/// lingering in the column). `current_version_id` is the file's version *at
/// attach time* - used only to seed `last_seen_version_id` so the first
/// always-latest sync afterwards doesn't mistake "the version present when
/// this was attached" for a change that just happened.
#[allow(clippy::too_many_arguments)]
pub fn attach(
    conn: &Connection,
    id: &str,
    task_id: &str,
    file_id: &str,
    fixed_version_id: Option<&str>,
    always_latest: bool,
    current_version_id: Option<&str>,
    cached_file_name: &str,
    now: &str,
) -> rusqlite::Result<()> {
    let last_seen = if always_latest { current_version_id } else { None };
    conn.execute(
        "INSERT INTO tracker_task_files \
         (id, task_id, file_id, version_id, always_latest, last_seen_version_id, unseen_update, cached_file_name, position, added_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, \
         (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_task_files WHERE task_id = ?2), ?8)",
        params![id, task_id, file_id, fixed_version_id, always_latest, last_seen, cached_file_name, now],
    )?;
    Ok(())
}

pub fn detach(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_task_files WHERE id = ?1", params![id])
}

pub fn clear_unseen(conn: &Connection, task_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_task_files SET unseen_update = 0 WHERE task_id = ?1 AND unseen_update = 1",
        params![task_id],
    )
}

#[derive(Serialize)]
struct FileVersionUpdatedPayload<'a> {
    file_name: &'a str,
    from_version: Option<i64>,
    to_version: i64,
}

/// Reconciles every "always latest" attachment against its file's current
/// version. This is what makes that mode work at all: a task never copies a
/// version number down onto itself, it just remembers the version id it last
/// saw, and every read re-checks it against `files.current_version_id` -
/// files/file_versions stay the single source of truth (spec section 36).
///
/// The very first time a fresh attachment is checked (`last_seen_version_id`
/// still NULL) this only records a baseline, it does not log a change - the
/// version present at attach time is not "an update", only versions that
/// arrive afterwards are.
pub fn sync_always_latest_all(conn: &Connection, now: &str) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "SELECT tf.id, tf.task_id, tf.last_seen_version_id, f.current_version_id, f.name \
         FROM tracker_task_files tf \
         JOIN files f ON f.id = tf.file_id \
         WHERE tf.always_latest = 1 AND f.current_version_id IS NOT NULL \
         AND (tf.last_seen_version_id IS NULL OR tf.last_seen_version_id != f.current_version_id)",
    )?;
    struct Pending {
        id: String,
        task_id: String,
        last_seen: Option<String>,
        current: String,
        file_name: String,
    }
    let pending: Vec<Pending> = stmt
        .query_map([], |row| {
            Ok(Pending {
                id: row.get(0)?,
                task_id: row.get(1)?,
                last_seen: row.get(2)?,
                current: row.get(3)?,
                file_name: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    drop(stmt);

    for p in pending {
        match p.last_seen {
            None => {
                conn.execute(
                    "UPDATE tracker_task_files SET last_seen_version_id = ?2 WHERE id = ?1",
                    params![p.id, p.current],
                )?;
            }
            Some(_) => {
                let from_version: Option<i64> = p
                    .last_seen
                    .as_ref()
                    .and_then(|v| {
                        conn.query_row(
                            "SELECT version_number FROM file_versions WHERE id = ?1",
                            params![v],
                            |r| r.get(0),
                        )
                        .optional()
                        .ok()
                        .flatten()
                    });
                let to_version: i64 = conn.query_row(
                    "SELECT version_number FROM file_versions WHERE id = ?1",
                    params![p.current],
                    |r| r.get(0),
                )?;
                conn.execute(
                    "UPDATE tracker_task_files SET last_seen_version_id = ?2, unseen_update = 1 WHERE id = ?1",
                    params![p.id, p.current],
                )?;
                tracker_events::log(
                    conn,
                    &p.task_id,
                    "file_version_updated",
                    &FileVersionUpdatedPayload { file_name: &p.file_name, from_version, to_version },
                    None,
                    now,
                )?;
            }
        }
    }
    Ok(())
}
