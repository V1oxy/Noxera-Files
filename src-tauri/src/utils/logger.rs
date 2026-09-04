use std::io::Write;

use crate::storage::StorageRoot;

/// Appends a single timestamped line to `<storage>/logs/app.log`. Best
/// effort - logging must never itself cause a user-facing failure.
pub fn append(storage: &StorageRoot, message: &str) {
    let logs_dir = storage.logs_dir();
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(logs_dir.join("app.log"))
    {
        let _ = writeln!(f, "[{}] {}", chrono::Utc::now().to_rfc3339(), message);
    }
}
