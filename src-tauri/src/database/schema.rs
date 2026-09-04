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
"#;

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
