pub mod error;
pub mod id;
pub mod logger;

pub use error::{AppError, AppResult};

/// RFC3339 timestamp for "now", used for created_at/updated_at columns.
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
