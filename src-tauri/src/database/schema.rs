/// Table definitions only. Run first, before any migration or index
/// creation, since `CREATE TABLE IF NOT EXISTS` is a no-op on a database
/// from an older version of the app - indexes that reference a column added
/// by a later version (e.g. `files.folder_id`) must not run until after
/// `migrate()` has ensured that column actually exists.
pub const TABLES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id                TEXT PRIMARY KEY,
    project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_folder_id  TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    position          INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    folder_id           TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    current_version_id  TEXT,
    next_version_number INTEGER NOT NULL DEFAULT 1,
    position            INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_versions (
    id                 TEXT PRIMARY KEY,
    file_id            TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number     INTEGER NOT NULL,
    storage_path       TEXT NOT NULL,
    original_filename  TEXT NOT NULL,
    file_size          INTEGER NOT NULL,
    mime_type          TEXT,
    checksum           TEXT NOT NULL,
    description        TEXT,
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Tracker: Kanban boards -----------------------------------------------------
-- Built on top of the existing projects/files/file_versions model rather than
-- duplicating it - a task never owns file data of its own, it only points at
-- rows in the tables above (see tracker_task_files below).

CREATE TABLE IF NOT EXISTS tracker_boards (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    card_size   TEXT NOT NULL DEFAULT 'normal',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_statuses (
    id               TEXT PRIMARY KEY,
    board_id         TEXT NOT NULL REFERENCES tracker_boards(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    color            TEXT NOT NULL DEFAULT '#8E8E93',
    position         INTEGER NOT NULL DEFAULT 0,
    is_default       INTEGER NOT NULL DEFAULT 0,
    is_done          INTEGER NOT NULL DEFAULT 0,
    move_to_archive  INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_fields (
    id             TEXT PRIMARY KEY,
    board_id       TEXT NOT NULL REFERENCES tracker_boards(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    field_type     TEXT NOT NULL,
    options        TEXT,
    default_value  TEXT,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_labels (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES tracker_boards(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8E8E93',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

-- Priority levels are per-board, edited from board settings, exactly like
-- statuses - a task's `priority` column (below) stores one of these rows'
-- id, not a fixed global slug.
CREATE TABLE IF NOT EXISTS tracker_priorities (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES tracker_boards(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8E8E93',
    position    INTEGER NOT NULL DEFAULT 0,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_tasks (
    id            TEXT PRIMARY KEY,
    board_id      TEXT NOT NULL REFERENCES tracker_boards(id) ON DELETE CASCADE,
    status_id     TEXT NOT NULL REFERENCES tracker_statuses(id) ON DELETE RESTRICT,
    title         TEXT NOT NULL,
    description   TEXT,
    project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
    customer      TEXT,
    priority      TEXT NOT NULL DEFAULT 'normal',
    pinned        INTEGER NOT NULL DEFAULT 0,
    archived      INTEGER NOT NULL DEFAULT 0,
    position      INTEGER NOT NULL DEFAULT 0,
    received_at   TEXT NOT NULL,
    completed_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_task_labels (
    task_id  TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES tracker_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS tracker_field_values (
    task_id  TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES tracker_fields(id) ON DELETE CASCADE,
    value    TEXT,
    PRIMARY KEY (task_id, field_id)
);

-- A task never has its own copy of a file - it references files.id /
-- file_versions.id directly, deliberately with NO foreign-key constraint (so
-- deleting a file or a version, which is the file manager's business alone,
-- can never fail or cascade because a task happens to point at it). Losing
-- the referenced row just turns into "file no longer exists" at read time,
-- resolved by tracker_tasks::sync_task_files - see that function.
CREATE TABLE IF NOT EXISTS tracker_task_files (
    id                    TEXT PRIMARY KEY,
    task_id               TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
    file_id               TEXT NOT NULL,
    version_id            TEXT,
    always_latest         INTEGER NOT NULL DEFAULT 0,
    last_seen_version_id  TEXT,
    unseen_update         INTEGER NOT NULL DEFAULT 0,
    cached_file_name      TEXT NOT NULL,
    position              INTEGER NOT NULL DEFAULT 0,
    added_at              TEXT NOT NULL
);

-- Automatic history entries and user-written comments share one
-- chronological log (spec: comments "are part of the task's history, but
-- visually separate from technical events") - `kind` tells the UI which is
-- which. `payload` is a small JSON blob whose shape depends on `kind`.
-- This table is also the seed of the event architecture future notifications
-- (assigned, status changed, deadline changed, new comment, new file
-- version, overdue) would hang off - see spec section 39.
CREATE TABLE IF NOT EXISTS tracker_task_events (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    payload    TEXT,
    author     TEXT,
    created_at TEXT NOT NULL
);

-- A file attached "from the computer" rather than picked from the app's own
-- storage - its bytes live only under this task (tracker_attachments/<task_id>/
-- on disk), never inside `files`/`file_versions`, and are removed for good
-- the moment this row or its task goes away. Versioned like the main file
-- manager's files/file_versions pair, but simpler: no "always latest" toggle
-- (nothing else points at a local file's version the way a task attachment
-- points at a real file's, so there's nothing to keep following) -
-- `current_version_id` just marks the version shown by default, freely
-- repointed by "restore" without touching version numbers or deleting
-- anything (a restore must not lose newer versions - see `restore_version`
-- below).
CREATE TABLE IF NOT EXISTS tracker_task_local_files (
    id                    TEXT PRIMARY KEY,
    task_id               TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
    file_name             TEXT NOT NULL,
    current_version_id    TEXT,
    next_version_number   INTEGER NOT NULL DEFAULT 1,
    position              INTEGER NOT NULL DEFAULT 0,
    added_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracker_task_local_file_versions (
    id              TEXT PRIMARY KEY,
    local_file_id   TEXT NOT NULL REFERENCES tracker_task_local_files(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    storage_path    TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    mime_type       TEXT,
    added_at        TEXT NOT NULL
);

-- Links: a small bookmark manager with its own "project" concept, entirely
-- separate from the file manager's `projects` table above - a link project
-- is just a user-created label to organize bookmarks and is never implied
-- by, or tied to, an actual file-manager project. A link always belongs to
-- one of these, optionally to a group within it - deleting a group never
-- deletes its links (ON DELETE SET NULL), it just ungroups them, matching
-- the product requirement that groups are purely organizational. Deleting a
-- link project, unlike deleting a group, does cascade to its groups and
-- links - it is the equivalent of deleting the whole collection.
CREATE TABLE IF NOT EXISTS link_projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_groups (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES link_projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES link_projects(id) ON DELETE CASCADE,
    group_id    TEXT REFERENCES link_groups(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    description TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
"#;

/// Index definitions only. Run last (after `TABLES_SQL` and `migrate()`),
/// once every column they reference is guaranteed to exist.
pub const INDEXES_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_folders_project_id ON folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_versions_file_version
    ON file_versions(file_id, version_number);

CREATE INDEX IF NOT EXISTS idx_tracker_statuses_board_id ON tracker_statuses(board_id);
CREATE INDEX IF NOT EXISTS idx_tracker_fields_board_id ON tracker_fields(board_id);
CREATE INDEX IF NOT EXISTS idx_tracker_labels_board_id ON tracker_labels(board_id);
CREATE INDEX IF NOT EXISTS idx_tracker_priorities_board_id ON tracker_priorities(board_id);
CREATE INDEX IF NOT EXISTS idx_tracker_tasks_board_id ON tracker_tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tracker_tasks_status_id ON tracker_tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tracker_tasks_project_id ON tracker_tasks(project_id);
-- Matches list_for_board's per-column window (PARTITION BY status_id ORDER
-- BY pinned, position) and list_for_board_column's page query exactly, so
-- SQLite can walk both straight off the index instead of sorting a whole
-- board's rows to find the top of each column.
CREATE INDEX IF NOT EXISTS idx_tracker_tasks_board_status_order
    ON tracker_tasks(board_id, status_id, pinned DESC, position ASC);
CREATE INDEX IF NOT EXISTS idx_tracker_task_labels_label_id ON tracker_task_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_tracker_field_values_field_id ON tracker_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_tracker_task_files_task_id ON tracker_task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_tracker_task_files_file_id ON tracker_task_files(file_id);
CREATE INDEX IF NOT EXISTS idx_tracker_task_events_task_id ON tracker_task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_tracker_task_local_files_task_id ON tracker_task_local_files(task_id);
CREATE INDEX IF NOT EXISTS idx_tracker_task_local_file_versions_local_file_id ON tracker_task_local_file_versions(local_file_id);
CREATE INDEX IF NOT EXISTS idx_link_groups_project_id ON link_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_links_project_id ON links(project_id);
CREATE INDEX IF NOT EXISTS idx_links_group_id ON links(group_id);
"#;

/// True if `table`'s current schema (as recorded by SQLite) contains the
/// literal text `REFERENCES {referenced}` - used below to detect the one
/// pre-release shape of `links`/`link_groups` that pointed straight at the
/// file manager's `projects` table.
fn table_references(conn: &rusqlite::Connection, table: &str, referenced: &str) -> rusqlite::Result<bool> {
    use rusqlite::OptionalExtension;
    let sql: Option<String> = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1",
            rusqlite::params![table],
            |r| r.get(0),
        )
        .optional()?;
    Ok(sql.is_some_and(|s| s.contains(&format!("REFERENCES {referenced}"))))
}

/// Statements applied after `TABLES_SQL`, guarded by their own existence
/// checks, to bring a database created by an older version of the app up to
/// date without touching any data already in it. Must run before
/// `INDEXES_SQL`.
pub fn migrate(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    if !column_exists(conn, "files", "folder_id")? {
        conn.execute_batch(
            "ALTER TABLE files ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE;",
        )?;
    }

    // `position` drives the manual drag-and-drop order. New installs get it
    // from TABLES_SQL already; a database from before this column existed
    // gets it backfilled here from whatever order it displayed in before, so
    // upgrading never visibly reshuffles anything until the user drags.
    if !column_exists(conn, "projects", "position")? {
        conn.execute_batch("ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0;")?;
        backfill_positions(conn, "SELECT id FROM projects ORDER BY updated_at DESC", "projects")?;
    }
    if !column_exists(conn, "folders", "position")? {
        conn.execute_batch("ALTER TABLE folders ADD COLUMN position INTEGER NOT NULL DEFAULT 0;")?;
        backfill_positions(
            conn,
            "SELECT id FROM folders ORDER BY parent_folder_id, name COLLATE NOCASE ASC",
            "folders",
        )?;
    }
    if !column_exists(conn, "files", "position")? {
        conn.execute_batch("ALTER TABLE files ADD COLUMN position INTEGER NOT NULL DEFAULT 0;")?;
        backfill_positions(
            conn,
            "SELECT id FROM files ORDER BY folder_id, updated_at DESC",
            "files",
        )?;
    }

    // A custom field can now carry a default value, pre-filled when a new
    // task is created (spec: "Если для поля задано значение по умолчанию -
    // использовать его") - existing databases predate the column.
    if !column_exists(conn, "tracker_fields", "default_value")? {
        conn.execute_batch("ALTER TABLE tracker_fields ADD COLUMN default_value TEXT;")?;
    }

    // A status can now be flagged to auto-archive any task moved into it
    // (spec: "Статус с автоматическим перемещением в архив") - existing
    // databases predate the column, so backfill it as "off" for every
    // existing status rather than losing/resetting anything else about them.
    if !column_exists(conn, "tracker_statuses", "move_to_archive")? {
        conn.execute_batch(
            "ALTER TABLE tracker_statuses ADD COLUMN move_to_archive INTEGER NOT NULL DEFAULT 0;",
        )?;
    }

    // "Assignee" and "deadline" never had any way to be set from the UI, so
    // the columns only ever held NULL - drop them from any database created
    // before this cleanup rather than leaving dead columns behind.
    if column_exists(conn, "tracker_tasks", "assignee")? {
        conn.execute_batch("ALTER TABLE tracker_tasks DROP COLUMN assignee;")?;
    }
    if column_exists(conn, "tracker_tasks", "due_at")? {
        conn.execute_batch("ALTER TABLE tracker_tasks DROP COLUMN due_at;")?;
    }

    // Local file attachments gained version history - existing installs have
    // the old flat one-version-per-row shape (storage_path/file_size/
    // mime_type directly on tracker_task_local_files). Split each existing
    // row into a "version 1" row in the new
    // tracker_task_local_file_versions table, point current_version_id at
    // it, then drop the now-redundant columns - nothing existing is lost,
    // every attachment just starts its version history at v1.
    if !column_exists(conn, "tracker_task_local_files", "current_version_id")? {
        conn.execute_batch(
            "ALTER TABLE tracker_task_local_files ADD COLUMN current_version_id TEXT; \
             ALTER TABLE tracker_task_local_files ADD COLUMN next_version_number INTEGER NOT NULL DEFAULT 1;",
        )?;
        migrate_local_file_versions(conn)?;
        conn.execute_batch(
            "ALTER TABLE tracker_task_local_files DROP COLUMN storage_path; \
             ALTER TABLE tracker_task_local_files DROP COLUMN file_size; \
             ALTER TABLE tracker_task_local_files DROP COLUMN mime_type;",
        )?;
    }

    backfill_priorities(conn)?;
    seed_default_board(conn)?;

    // Links shipped for one release with `project_id` pointing straight at
    // the file manager's `projects` table before it got its own independent
    // `link_projects` table (see TABLES_SQL above) - `CREATE TABLE IF NOT
    // EXISTS` above left any such pre-existing `links`/`link_groups` table
    // as-is, so recreate them here against the current schema. Links had no
    // real user data yet at the point this changed, so a plain drop (rather
    // than a data-preserving migration) is deliberate.
    if table_references(conn, "links", "projects")? {
        conn.execute_batch("DROP TABLE IF EXISTS links; DROP TABLE IF EXISTS link_groups;")?;
        conn.execute_batch(TABLES_SQL)?;
    }

    Ok(())
}

/// The default priority set every board gets, in position order - matches
/// what used to be the app-wide fixed set before priorities became per-board.
const DEFAULT_PRIORITIES: [(&str, &str, &str); 4] = [
    ("low", "Low", "#8E8E93"),
    ("normal", "Normal", "#0A84FF"),
    ("high", "High", "#FF9F0A"),
    ("critical", "Critical", "#FF453A"),
];

/// Inserts the default priority rows for one board and returns each one's
/// old slug alongside its new row id, so a caller migrating existing tasks
/// can map `tracker_tasks.priority` (which used to hold that slug directly)
/// onto the new row.
fn seed_default_priorities(
    conn: &rusqlite::Connection,
    board_id: &str,
    now: &str,
) -> rusqlite::Result<Vec<(&'static str, String)>> {
    let mut mapping = Vec::new();
    for (i, (slug, name, color)) in DEFAULT_PRIORITIES.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tracker_priorities (id, board_id, name, color, position, is_default, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            rusqlite::params![id, board_id, name, color, i as i64, *slug == "normal", now],
        )?;
        mapping.push((*slug, id));
    }
    Ok(mapping)
}

/// Gives every board that predates the `tracker_priorities` table its own
/// default set (seeded once, guarded by "does this board have any priorities
/// yet") and remaps its tasks' `priority` column from the old fixed slug
/// ('low'/'normal'/'high'/'critical') to the new row's id - a no-op on every
/// run after the first, since a board never has zero priorities again once
/// it has at least the four default rows.
fn backfill_priorities(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let board_ids: Vec<String> = {
        let mut stmt = conn.prepare("SELECT id FROM tracker_boards")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    for board_id in board_ids {
        let has_priorities: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM tracker_priorities WHERE board_id = ?1)",
            rusqlite::params![board_id],
            |r| r.get(0),
        )?;
        if has_priorities {
            continue;
        }
        let now = chrono::Utc::now().to_rfc3339();
        let mapping = seed_default_priorities(conn, &board_id, &now)?;
        for (slug, id) in mapping {
            conn.execute(
                "UPDATE tracker_tasks SET priority = ?1 WHERE board_id = ?2 AND priority = ?3",
                rusqlite::params![id, board_id, slug],
            )?;
        }
    }
    Ok(())
}

/// Gives every install (fresh or upgraded from a pre-tracker version) one
/// ready-to-use board the first time this runs, so "Tracker" never opens to
/// a completely empty screen. A no-op once any board exists - a user who
/// deletes this board (or all boards) is never handed a fresh one back.
fn seed_default_board(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let has_board: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM tracker_boards)", [], |r| r.get(0))?;
    if has_board {
        return Ok(());
    }
    let now = chrono::Utc::now().to_rfc3339();
    let board_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tracker_boards (id, name, description, card_size, position, created_at, updated_at) \
         VALUES (?1, ?2, NULL, 'normal', 0, ?3, ?3)",
        rusqlite::params![board_id, "Development", now],
    )?;
    let statuses: [(&str, &str, bool); 4] = [
        ("New", "#8E8E93", false),
        ("In Progress", "#0A84FF", false),
        ("In Review", "#FF9F0A", false),
        ("Done", "#30D158", true),
    ];
    for (i, (name, color, is_done)) in statuses.iter().enumerate() {
        let status_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tracker_statuses (id, board_id, name, color, position, is_default, is_done, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            rusqlite::params![status_id, board_id, name, color, i as i64, i == 0, is_done, now],
        )?;
    }
    seed_default_priorities(conn, &board_id, &now)?;
    Ok(())
}

/// One-time move of every existing local-file-attachment row's own
/// storage_path/file_size/mime_type into a freshly created "version 1" row
/// in `tracker_task_local_file_versions`, called while those columns still
/// exist on `tracker_task_local_files` (right before they're dropped) - see
/// the `current_version_id` migration step above.
fn migrate_local_file_versions(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    struct OldRow {
        id: String,
        storage_path: String,
        file_size: i64,
        mime_type: Option<String>,
        added_at: String,
    }
    let rows: Vec<OldRow> = {
        let mut stmt = conn.prepare("SELECT id, storage_path, file_size, mime_type, added_at FROM tracker_task_local_files")?;
        let rows = stmt.query_map([], |r| {
            Ok(OldRow {
                id: r.get(0)?,
                storage_path: r.get(1)?,
                file_size: r.get(2)?,
                mime_type: r.get(3)?,
                added_at: r.get(4)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    for row in rows {
        let version_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tracker_task_local_file_versions \
             (id, local_file_id, version_number, storage_path, file_size, mime_type, added_at) \
             VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)",
            rusqlite::params![version_id, row.id, row.storage_path, row.file_size, row.mime_type, row.added_at],
        )?;
        conn.execute(
            "UPDATE tracker_task_local_files SET current_version_id = ?1, next_version_number = 2 WHERE id = ?2",
            rusqlite::params![version_id, row.id],
        )?;
    }
    Ok(())
}

/// Assigns sequential `position` values (in the order `select_ids_sql`
/// returns them) to every row of `table`. `select_ids_sql` groups by parent
/// scope so that e.g. folder positions are only ever compared to siblings
/// under the same parent, never across the whole table.
fn backfill_positions(
    conn: &rusqlite::Connection,
    select_ids_sql: &str,
    table: &str,
) -> rusqlite::Result<()> {
    let ids: Vec<String> = {
        let mut stmt = conn.prepare(select_ids_sql)?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    let update_sql = format!("UPDATE {table} SET position = ?2 WHERE id = ?1");
    let mut stmt = conn.prepare(&update_sql)?;
    for (i, id) in ids.iter().enumerate() {
        stmt.execute(rusqlite::params![id, i as i64])?;
    }
    Ok(())
}

fn column_exists(conn: &rusqlite::Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get("name")?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A database from before this cleanup would still have `assignee`/
    /// `due_at` on `tracker_tasks` - simulate that by adding the columns
    /// back onto a freshly-created (already column-less) database, then
    /// re-running `migrate` as if the app had just been reopened, and check
    /// they're gone.
    #[test]
    fn migrate_drops_legacy_assignee_and_due_at_columns() {
        let dir = std::env::temp_dir().join(format!("noxera-schema-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");

        crate::database::open(&db_path).expect("fresh open should succeed");

        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "ALTER TABLE tracker_tasks ADD COLUMN assignee TEXT; \
                 ALTER TABLE tracker_tasks ADD COLUMN due_at TEXT;",
            )
            .unwrap();
            assert!(column_exists(&conn, "tracker_tasks", "assignee").unwrap());
            assert!(column_exists(&conn, "tracker_tasks", "due_at").unwrap());
        }

        let conn = crate::database::open(&db_path).expect("reopen should re-run migrate");
        assert!(!column_exists(&conn, "tracker_tasks", "assignee").unwrap());
        assert!(!column_exists(&conn, "tracker_tasks", "due_at").unwrap());

        drop(conn);
        std::fs::remove_dir_all(&dir).ok();
    }

    /// A database from before local-file versioning would have
    /// storage_path/file_size/mime_type directly on
    /// tracker_task_local_files and no current_version_id/
    /// next_version_number - simulate that shape on a fresh (already
    /// migrated) database, insert one row the old way, then reopen (as if
    /// the app had just been upgraded) and check it became a proper
    /// "version 1", current, with the old columns gone and nothing lost.
    #[test]
    fn migrate_splits_legacy_local_file_rows_into_version_1() {
        let dir = std::env::temp_dir().join(format!("noxera-schema-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");

        crate::database::open(&db_path).expect("fresh open should succeed");

        let local_file_id = uuid::Uuid::new_v4().to_string();
        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            // The fake row below points at a task_id that doesn't really
            // exist - fine for this test (the migration itself never reads
            // task_id), but needs FK enforcement off on this connection or
            // the insert itself is rejected.
            conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
            conn.execute_batch(
                "ALTER TABLE tracker_task_local_files DROP COLUMN current_version_id; \
                 ALTER TABLE tracker_task_local_files DROP COLUMN next_version_number; \
                 ALTER TABLE tracker_task_local_files ADD COLUMN storage_path TEXT NOT NULL DEFAULT ''; \
                 ALTER TABLE tracker_task_local_files ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0; \
                 ALTER TABLE tracker_task_local_files ADD COLUMN mime_type TEXT;",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO tracker_task_local_files (id, task_id, file_name, storage_path, file_size, mime_type, position, added_at) \
                 VALUES (?1, 'fake-task', 'Инструкция.docx', 'tracker_attachments/fake-task/old.docx', 12345, 'application/msword', 0, '2026-01-01T00:00:00Z')",
                rusqlite::params![local_file_id],
            )
            .unwrap();
        }

        let conn = crate::database::open(&db_path).expect("reopen should re-run migrate");
        assert!(!column_exists(&conn, "tracker_task_local_files", "storage_path").unwrap());
        assert!(!column_exists(&conn, "tracker_task_local_files", "file_size").unwrap());
        assert!(!column_exists(&conn, "tracker_task_local_files", "mime_type").unwrap());

        let (current_version_id, next_version_number): (String, i64) = conn
            .query_row(
                "SELECT current_version_id, next_version_number FROM tracker_task_local_files WHERE id = ?1",
                rusqlite::params![local_file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(next_version_number, 2);

        let (version_number, storage_path, file_size, mime_type): (i64, String, i64, Option<String>) = conn
            .query_row(
                "SELECT version_number, storage_path, file_size, mime_type FROM tracker_task_local_file_versions WHERE id = ?1",
                rusqlite::params![current_version_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(version_number, 1);
        assert_eq!(storage_path, "tracker_attachments/fake-task/old.docx");
        assert_eq!(file_size, 12345);
        assert_eq!(mime_type.as_deref(), Some("application/msword"));

        drop(conn);
        std::fs::remove_dir_all(&dir).ok();
    }
}
