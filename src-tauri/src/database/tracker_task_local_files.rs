use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::models::{TaskLocalFile, TaskLocalFileVersion};

const SELECT_BASE: &str = "SELECT f.id, f.task_id, f.file_name, f.current_version_id, f.next_version_number, f.added_at, \
    (SELECT COUNT(*) FROM tracker_task_local_file_versions v WHERE v.local_file_id = f.id) AS version_count, \
    cv.file_size AS cv_file_size, cv.mime_type AS cv_mime_type \
    FROM tracker_task_local_files f LEFT JOIN tracker_task_local_file_versions cv ON cv.id = f.current_version_id";

fn map_row(row: &Row) -> rusqlite::Result<TaskLocalFile> {
    Ok(TaskLocalFile {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        file_name: row.get("file_name")?,
        file_size: row.get::<_, Option<i64>>("cv_file_size")?.unwrap_or(0),
        mime_type: row.get("cv_mime_type")?,
        added_at: row.get("added_at")?,
        current_version_id: row.get("current_version_id")?,
        version_count: row.get("version_count")?,
        versions: Vec::new(),
    })
}

fn map_version_row(row: &Row) -> rusqlite::Result<TaskLocalFileVersion> {
    Ok(TaskLocalFileVersion {
        id: row.get("id")?,
        local_file_id: row.get("local_file_id")?,
        version_number: row.get("version_number")?,
        file_size: row.get("file_size")?,
        mime_type: row.get("mime_type")?,
        added_at: row.get("added_at")?,
    })
}

pub fn list_versions(conn: &Connection, local_file_id: &str) -> rusqlite::Result<Vec<TaskLocalFileVersion>> {
    let mut stmt = conn.prepare(
        "SELECT id, local_file_id, version_number, file_size, mime_type, added_at \
         FROM tracker_task_local_file_versions WHERE local_file_id = ?1 ORDER BY version_number DESC",
    )?;
    let rows = stmt.query_map(params![local_file_id], map_version_row)?;
    rows.collect()
}

/// Every attachment on a task, each with its full version history attached -
/// local-file counts per task are always small, so one extra query per
/// attachment here is cheap and keeps the caller from having to fetch
/// versions separately.
pub fn list_for_task(conn: &Connection, task_id: &str) -> rusqlite::Result<Vec<TaskLocalFile>> {
    let sql = format!("{SELECT_BASE} WHERE f.task_id = ?1 ORDER BY f.position ASC, f.added_at ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![task_id], map_row)?;
    let mut files = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    for file in &mut files {
        file.versions = list_versions(conn, &file.id)?;
    }
    Ok(files)
}

/// Row shape needed to remove the physical file(s) alongside the DB rows -
/// `get_for_delete`/`get` return the current version's storage path too,
/// which the public `TaskLocalFile` (used only to display metadata)
/// deliberately never exposes.
pub struct LocalFileWithPath {
    pub file: TaskLocalFile,
    pub storage_path: String,
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<LocalFileWithPath>> {
    conn.query_row(
        "SELECT f.id, f.task_id, f.file_name, f.current_version_id, f.next_version_number, f.added_at, \
         (SELECT COUNT(*) FROM tracker_task_local_file_versions v WHERE v.local_file_id = f.id) AS version_count, \
         cv.file_size AS cv_file_size, cv.mime_type AS cv_mime_type, cv.storage_path AS cv_storage_path \
         FROM tracker_task_local_files f LEFT JOIN tracker_task_local_file_versions cv ON cv.id = f.current_version_id \
         WHERE f.id = ?1",
        params![id],
        |row| {
            Ok(LocalFileWithPath {
                file: map_row(row)?,
                storage_path: row.get("cv_storage_path")?,
            })
        },
    )
    .optional()
}

/// One specific version's storage path, for viewing/opening a version other
/// than the current one.
pub struct VersionWithPath {
    pub version: TaskLocalFileVersion,
    pub storage_path: String,
}

pub fn get_version(conn: &Connection, version_id: &str) -> rusqlite::Result<Option<VersionWithPath>> {
    conn.query_row(
        "SELECT id, local_file_id, version_number, file_size, mime_type, added_at, storage_path \
         FROM tracker_task_local_file_versions WHERE id = ?1",
        params![version_id],
        |row| {
            Ok(VersionWithPath {
                version: map_version_row(row)?,
                storage_path: row.get("storage_path")?,
            })
        },
    )
    .optional()
}

/// Every version's storage path for one attachment, oldest first - used to
/// remove every physical copy on disk when the whole attachment is deleted
/// (the DB rows themselves cascade via the FK, but the files on disk don't).
pub fn list_version_paths(conn: &Connection, local_file_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT storage_path FROM tracker_task_local_file_versions WHERE local_file_id = ?1 ORDER BY version_number ASC",
    )?;
    let rows = stmt.query_map(params![local_file_id], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// Attaches a brand-new local file to a task - its first version (v1),
/// immediately current.
#[allow(clippy::too_many_arguments)]
pub fn create(
    conn: &Connection,
    id: &str,
    task_id: &str,
    file_name: &str,
    storage_path: &str,
    file_size: i64,
    mime_type: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tracker_task_local_files (id, task_id, file_name, next_version_number, position, added_at) \
         VALUES (?1, ?2, ?3, 1, \
         (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_task_local_files WHERE task_id = ?2), ?4)",
        params![id, task_id, file_name, now],
    )?;
    let version_id = crate::utils::id::new_id();
    add_version_row(conn, &version_id, id, 1, storage_path, file_size, mime_type, now)?;
    conn.execute(
        "UPDATE tracker_task_local_files SET current_version_id = ?1, next_version_number = 2 WHERE id = ?2",
        params![version_id, id],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn add_version_row(
    conn: &Connection,
    version_id: &str,
    local_file_id: &str,
    version_number: i64,
    storage_path: &str,
    file_size: i64,
    mime_type: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tracker_task_local_file_versions \
         (id, local_file_id, version_number, storage_path, file_size, mime_type, added_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![version_id, local_file_id, version_number, storage_path, file_size, mime_type, now],
    )?;
    Ok(())
}

/// Adds a new version to an already-attached local file - it becomes the
/// current version automatically (spec: "последняя добавленная версия
/// является текущей автоматически"), and no existing version is touched.
#[allow(clippy::too_many_arguments)]
pub fn add_version(
    conn: &Connection,
    local_file_id: &str,
    version_id: &str,
    storage_path: &str,
    file_size: i64,
    mime_type: Option<&str>,
    now: &str,
) -> rusqlite::Result<i64> {
    let version_number: i64 = conn.query_row(
        "SELECT next_version_number FROM tracker_task_local_files WHERE id = ?1",
        params![local_file_id],
        |r| r.get(0),
    )?;
    add_version_row(conn, version_id, local_file_id, version_number, storage_path, file_size, mime_type, now)?;
    conn.execute(
        "UPDATE tracker_task_local_files SET current_version_id = ?1, next_version_number = ?2 WHERE id = ?3",
        params![version_id, version_number + 1, local_file_id],
    )?;
    Ok(version_number)
}

/// Makes an existing version current again, without creating a new version
/// or touching any other row - the version being "restored away from" (and
/// every other one) stays exactly where it is in the history (spec: "версия
/// 3 не должна удаляться").
pub fn restore_version(conn: &Connection, local_file_id: &str, version_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE tracker_task_local_files SET current_version_id = ?1 WHERE id = ?2",
        params![version_id, local_file_id],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM tracker_task_local_files WHERE id = ?1", params![id])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{tracker_boards, tracker_priorities, tracker_statuses, tracker_tasks};

    struct Fixture {
        conn: Connection,
        dir: std::path::PathBuf,
        task_id: String,
    }

    fn setup() -> Fixture {
        let dir = std::env::temp_dir().join(format!("noxera-local-files-test-{}", uuid::Uuid::new_v4()));
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

    /// Reproduces the exact scenario from the spec: attach a file (v1), add
    /// two more versions (v2, v3, each becoming current automatically),
    /// restore v2, and check the current version moves back without v3
    /// disappearing from the history.
    #[test]
    fn add_version_and_restore_keep_full_history() {
        let f = setup();
        let now = "2026-01-02T00:00:00+00:00";

        let file_id = "local-1".to_string();
        create(&f.conn, &file_id, &f.task_id, "Инструкция.docx", "path/v1", 100, Some("application/msword"), now).unwrap();

        let entry = get(&f.conn, &file_id).unwrap().unwrap();
        assert_eq!(entry.file.version_count, 1);
        assert_eq!(entry.file.file_size, 100);
        let v1_id = entry.file.current_version_id.clone().unwrap();

        let v2_id = "v2".to_string();
        let v2_number = add_version(&f.conn, &file_id, &v2_id, "path/v2", 200, Some("application/msword"), now).unwrap();
        assert_eq!(v2_number, 2);

        let v3_id = "v3".to_string();
        let v3_number = add_version(&f.conn, &file_id, &v3_id, "path/v3", 300, Some("application/msword"), now).unwrap();
        assert_eq!(v3_number, 3);

        let entry = get(&f.conn, &file_id).unwrap().unwrap();
        assert_eq!(entry.file.version_count, 3);
        assert_eq!(entry.file.current_version_id.as_deref(), Some(v3_id.as_str()));
        assert_eq!(entry.file.file_size, 300);

        // Restore v2 - it becomes current, but v1 and v3 must both still exist.
        restore_version(&f.conn, &file_id, &v2_id).unwrap();
        let entry = get(&f.conn, &file_id).unwrap().unwrap();
        assert_eq!(entry.file.current_version_id.as_deref(), Some(v2_id.as_str()));
        assert_eq!(entry.file.file_size, 200);
        assert_eq!(entry.file.version_count, 3, "restoring must not delete any version");

        let versions = list_versions(&f.conn, &file_id).unwrap();
        let mut numbers: Vec<i64> = versions.iter().map(|v| v.version_number).collect();
        numbers.sort();
        assert_eq!(numbers, vec![1, 2, 3]);

        // A version added after a restore keeps counting up from where
        // next_version_number left off (v4), it never reuses v3's number.
        let v4_id = "v4".to_string();
        let v4_number = add_version(&f.conn, &file_id, &v4_id, "path/v4", 400, None, now).unwrap();
        assert_eq!(v4_number, 4);

        let _ = v1_id;
        teardown(f);
    }
}
