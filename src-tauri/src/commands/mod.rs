pub mod backup;
pub mod files;
pub mod folders;
pub mod links;
pub mod projects;
pub mod settings;
pub mod tracker_boards;
pub mod tracker_settings;
pub mod tracker_tasks;
pub mod versions;

use crate::state::{AppState, AppStateInner};
use crate::storage::StorageRoot;
use crate::utils::{AppError, AppResult};
use rusqlite::Connection;

/// Locks the shared state and hands back the open connection + storage root,
/// or a friendly error if the app hasn't finished onboarding yet.
pub(crate) fn with_ready<T>(
    state: &AppState,
    f: impl FnOnce(&Connection, &StorageRoot) -> AppResult<T>,
) -> AppResult<T> {
    let guard = state
        .inner
        .lock()
        .map_err(|_| AppError::user("Internal state error."))?;
    match &*guard {
        AppStateInner::Ready { conn, storage } => {
            let result = f(conn, storage);
            if let Err(AppError::User {
                message,
                details: Some(details),
            }) = &result
            {
                crate::utils::logger::append(storage, &format!("{message} :: {details}"));
            }
            result
        }
        AppStateInner::Uninitialized => {
            Err(AppError::user("Storage has not been set up yet."))
        }
    }
}
