use std::path::{Path, PathBuf};

use crate::utils::{AppError, AppResult};

/// All physical paths the app writes to live under a single user-chosen
/// storage root (spec sections 8-9). Every path helper here either returns a
/// path built purely from internally-generated UUIDs, or validates a
/// DB-stored relative path stays inside the root before use - this is the
/// app's path-traversal defense (spec section 82).
#[derive(Debug, Clone)]
pub struct StorageRoot(PathBuf);

impl StorageRoot {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self(root.into())
    }

    pub fn root(&self) -> &Path {
        &self.0
    }

    pub fn database_path(&self) -> PathBuf {
        self.0.join("database.sqlite")
    }

    pub fn projects_dir(&self) -> PathBuf {
        self.0.join("projects")
    }

    pub fn backups_dir(&self) -> PathBuf {
        self.0.join("backups")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.0.join("logs")
    }

    pub fn temp_dir(&self) -> PathBuf {
        self.0.join("temp")
    }

    /// Where a task's "attach from computer" files live - separate from
    /// `projects/`, since these never belong to the file manager's own
    /// version history (spec: local-only task attachments).
    pub fn tracker_attachments_dir(&self) -> PathBuf {
        self.0.join("tracker_attachments")
    }

    pub fn task_attachment_dir(&self, task_id: &str) -> AppResult<PathBuf> {
        safe_join(&self.tracker_attachments_dir(), task_id)
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            self.0.clone(),
            self.projects_dir(),
            self.backups_dir(),
            self.logs_dir(),
            self.temp_dir(),
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    pub fn project_dir(&self, project_id: &str) -> AppResult<PathBuf> {
        safe_join(&self.projects_dir(), project_id)
    }

    pub fn file_dir(&self, project_id: &str, file_id: &str) -> AppResult<PathBuf> {
        safe_join(&self.project_dir(project_id)?.join("files"), file_id)
    }

    pub fn version_dir(
        &self,
        project_id: &str,
        file_id: &str,
        version_number: i64,
    ) -> AppResult<PathBuf> {
        safe_join(
            &self.file_dir(project_id, file_id)?,
            &format!("v{version_number}"),
        )
    }

    /// Resolves a DB-stored relative path (forward-slash separated) to an
    /// absolute path, refusing to leave the storage root.
    pub fn resolve_existing(&self, relative: &str) -> AppResult<PathBuf> {
        let candidate = self.0.join(relative);
        let candidate_canon = candidate
            .canonicalize()
            .map_err(|_| AppError::user("The referenced file could not be found on disk."))?;
        let root_canon = self
            .0
            .canonicalize()
            .map_err(|_| AppError::user("The storage folder is unavailable."))?;
        if !candidate_canon.starts_with(&root_canon) {
            return Err(AppError::user("Invalid file path."));
        }
        Ok(candidate_canon)
    }

    pub fn relative_path(&self, absolute: &Path) -> AppResult<String> {
        let rel = absolute
            .strip_prefix(&self.0)
            .map_err(|_| AppError::user("Invalid storage path."))?;
        Ok(rel.to_string_lossy().replace('\\', "/"))
    }
}

fn safe_join(base: &Path, segment: &str) -> AppResult<PathBuf> {
    let is_safe = !segment.is_empty()
        && segment != "."
        && segment != ".."
        && !segment.contains('/')
        && !segment.contains('\\')
        && !segment.contains('\0');
    if !is_safe {
        return Err(AppError::user("Invalid identifier."));
    }
    Ok(base.join(segment))
}

/// Sanitizes a user-supplied filename for safe, portable on-disk storage.
/// Each version already lives in its own UUID-scoped directory, so this only
/// needs to prevent path escapes and filesystem-illegal characters, not
/// guarantee uniqueness.
pub fn sanitize_filename(name: &str) -> String {
    let mut cleaned: String = name
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | '\0' => '_',
            '<' | '>' | ':' | '"' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();

    cleaned = cleaned
        .trim_start_matches(['.', ' '])
        .trim_end_matches([' ', '.'])
        .to_string();

    if cleaned.is_empty() {
        cleaned = "file".to_string();
    }
    if cleaned.chars().count() > 200 {
        cleaned = cleaned.chars().take(200).collect();
    }
    cleaned
}
