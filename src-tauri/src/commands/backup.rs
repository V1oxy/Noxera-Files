use std::fs::File;
use std::path::Path;

use serde::Serialize;
use tauri::State;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::state::AppState;
use crate::storage::{human_size, StorageRoot};
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub size_bytes: i64,
    pub size_human: String,
    pub created_at: String,
}

/// Bundles `database.sqlite` plus every physical project file into a single
/// timestamped zip under `backups/` (spec sections 63-64). The archive keeps
/// the same relative layout as the live storage root, so a future "restore
/// from backup" only has to extract it back over a storage root.
#[tauri::command]
pub fn create_backup(state: State<AppState>) -> AppResult<BackupResult> {
    with_ready(&state, |_conn, storage| {
        let now = chrono::Local::now();
        let filename = format!("ProjectManager_Backup_{}.zip", now.format("%Y-%m-%d_%H%M%S"));
        let backups_dir = storage.backups_dir();
        std::fs::create_dir_all(&backups_dir)?;
        let backup_path = backups_dir.join(&filename);

        write_backup_archive(storage, &backup_path)?;

        let size = std::fs::metadata(&backup_path).map(|m| m.len()).unwrap_or(0) as i64;
        Ok(BackupResult {
            path: backup_path.to_string_lossy().to_string(),
            size_bytes: size,
            size_human: human_size(size),
            created_at: now_iso(),
        })
    })
}

fn write_backup_archive(storage: &StorageRoot, backup_path: &Path) -> AppResult<()> {
    let file = File::create(backup_path)
        .map_err(|e| AppError::with_details("Unable to create the backup file.", e))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let db_path = storage.database_path();
    if db_path.exists() {
        add_file(&mut zip, &db_path, "database.sqlite", options)?;
    }

    let projects_dir = storage.projects_dir();
    if projects_dir.exists() {
        for entry in WalkDir::new(&projects_dir).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let Ok(rel) = path.strip_prefix(storage.root()) else {
                continue;
            };
            let name = rel.to_string_lossy().replace('\\', "/");
            if entry.file_type().is_dir() {
                let _ = zip.add_directory(format!("{name}/"), options);
            } else {
                add_file(&mut zip, path, &name, options)?;
            }
        }
    }

    zip.finish()
        .map_err(|e| AppError::with_details("Unable to finish writing the backup archive.", e))?;
    Ok(())
}

fn add_file(
    zip: &mut ZipWriter<File>,
    src: &Path,
    name: &str,
    options: SimpleFileOptions,
) -> AppResult<()> {
    zip.start_file(name, options)
        .map_err(|e| AppError::with_details("Unable to write to the backup archive.", e))?;
    let mut f = File::open(src)?;
    std::io::copy(&mut f, zip)
        .map_err(|e| AppError::with_details("Unable to write to the backup archive.", e))?;
    Ok(())
}
