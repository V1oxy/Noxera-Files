pub mod files;
pub mod folders;
pub mod link_groups;
pub mod link_projects;
pub mod links;
pub mod projects;
pub mod schema;
pub mod settings;
pub mod tracker_boards;
pub mod tracker_events;
pub mod tracker_field_values;
pub mod tracker_fields;
pub mod tracker_labels;
pub mod tracker_priorities;
pub mod tracker_statuses;
pub mod tracker_task_files;
pub mod tracker_task_links;
pub mod tracker_task_local_files;
pub mod tracker_tasks;
pub mod versions;

use std::path::Path;

use rusqlite::functions::FunctionFlags;
use rusqlite::Connection;

/// Opens (creating if necessary) the SQLite database at `db_path`, applies
/// pragmas suited for a single-process desktop app, and ensures the schema
/// exists. Safe to call on every launch - `CREATE TABLE IF NOT EXISTS`.
pub fn open(db_path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.execute_batch(schema::TABLES_SQL)?;
    schema::migrate(&conn)?;
    conn.execute_batch(schema::INDEXES_SQL)?;
    register_functions(&conn)?;
    Ok(conn)
}

/// Registers a `lower_unicode` SQL scalar function backed by Rust's
/// Unicode-aware `str::to_lowercase` - SQLite's built-in `LOWER()`/`NOCASE`
/// only case-folds ASCII, so e.g. Cyrillic "СПАМ" never matches "спам" under
/// plain `LOWER(x) LIKE ?`. Used in place of `LOWER()` wherever a query needs
/// to stay SQL-side (for `LIMIT`/`OFFSET` pagination or joined subqueries)
/// instead of fetching every row and filtering in Rust.
fn register_functions(conn: &Connection) -> rusqlite::Result<()> {
    conn.create_scalar_function(
        "lower_unicode",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| Ok(ctx.get::<String>(0)?.to_lowercase()),
    )
}
