use std::io::Write;

use crate::storage::StorageRoot;

/// Appends a single timestamped line to `<storage>/logs/app.log`. Best
/// effort - logging must never itself cause a user-facing failure.
fn write_line(storage: &StorageRoot, level: &str, message: &str) {
    let logs_dir = storage.logs_dir();
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs_dir.join("app.log"))
    {
        let _ = writeln!(f, "[{}] [{level}] {}", chrono::Utc::now().to_rfc3339(), message);
    }
}

/// Kept for existing call sites that log unexpected/failure conditions.
pub fn append(storage: &StorageRoot, message: &str) {
    write_line(storage, "ERROR", message);
}

/// Records a normal lifecycle event (project/file/folder/version
/// created/renamed/deleted, settings changed, backup made, app started...) -
/// this is what actually populates `logs/app.log` in day-to-day use, not
/// just the rare failure paths.
pub fn info(storage: &StorageRoot, message: &str) {
    write_line(storage, "INFO", message);
}
