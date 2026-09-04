use serde::{Serialize, Serializer};

/// User-facing application error.
///
/// Every error surfaced to the frontend carries a short, friendly `message`
/// plus optional technical `details` (raw OS/SQLite error text) that the UI
/// can hide behind a "Details" disclosure - see spec section 59.
#[derive(Debug)]
pub enum AppError {
    User {
        message: String,
        details: Option<String>,
    },
}

impl AppError {
    pub fn user(message: impl Into<String>) -> Self {
        AppError::User {
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(message: impl Into<String>, details: impl std::fmt::Display) -> Self {
        AppError::User {
            message: message.into(),
            details: Some(details.to_string()),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::User { message, .. } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::with_details("A database error occurred.", e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::with_details(
            "Unable to access the storage folder. Check that it is available and try again.",
            e,
        )
    }
}

#[derive(Serialize)]
struct ErrorPayload {
    message: String,
    details: Option<String>,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let AppError::User { message, details } = self;
        ErrorPayload {
            message: message.clone(),
            details: details.clone(),
        }
        .serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;
