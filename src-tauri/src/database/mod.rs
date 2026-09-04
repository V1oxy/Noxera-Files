pub mod files;
pub mod folders;
pub mod projects;
pub mod schema;
pub mod settings;
pub mod versions;

use std::path::Path;

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
    Ok(conn)
}
