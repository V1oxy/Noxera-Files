use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::utils::{AppError, AppResult};

pub struct CopyResult {
    pub size: u64,
    pub checksum: String,
}

/// Streams `src` into `final_path` through a temp file in `temp_dir`,
/// computing a SHA-256 checksum as it goes and reporting progress in 1 MiB
/// increments. The file only appears at `final_path` once fully written and
/// verified, so a crash mid-copy never leaves a partial version on disk
/// (spec sections 65-66) - callers must still not create the DB row until
/// this returns Ok.
pub fn copy_with_checksum<F: FnMut(u64, u64)>(
    src: &Path,
    final_path: &Path,
    temp_dir: &Path,
    mut on_progress: F,
) -> AppResult<CopyResult> {
    let metadata = std::fs::metadata(src)
        .map_err(|_| AppError::user("The selected file could not be found."))?;
    if !metadata.is_file() {
        return Err(AppError::user("Only regular files can be added."));
    }
    let total = metadata.len();

    std::fs::create_dir_all(temp_dir)?;
    let temp_path = temp_dir.join(format!("{}.part", uuid::Uuid::new_v4()));

    let result = (|| -> AppResult<CopyResult> {
        let mut reader = BufReader::new(File::open(src)?);
        let mut writer = BufWriter::new(File::create(&temp_path)?);
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 1024 * 1024];
        let mut written: u64 = 0;
        loop {
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
            writer.write_all(&buf[..n])?;
            hasher.update(&buf[..n]);
            written += n as u64;
            on_progress(written, total);
        }
        writer.flush()?;
        drop(writer);
        let digest = hasher.finalize();
        let checksum = digest.iter().map(|b| format!("{b:02x}")).collect::<String>();
        Ok(CopyResult {
            size: written,
            checksum,
        })
    })();

    match result {
        Ok(r) => {
            if let Some(parent) = final_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            move_into_place(&temp_path, final_path)?;
            Ok(r)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&temp_path);
            Err(e)
        }
    }
}

fn move_into_place(temp_path: &Path, final_path: &Path) -> std::io::Result<()> {
    if std::fs::rename(temp_path, final_path).is_ok() {
        return Ok(());
    }
    // Cross-device fallback (temp/ and the destination could theoretically be
    // on different filesystems if the user relocates storage later).
    std::fs::copy(temp_path, final_path)?;
    std::fs::remove_file(temp_path)
}

/// Removes a directory tree, retrying a few times on failure. On Windows in
/// particular, a file written moments ago can still be briefly locked by the
/// OS/antivirus, which would otherwise make a deletion right after an upload
/// fail with a sharing violation.
pub fn remove_dir_all_if_exists(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let mut last_err = None;
    for attempt in 0..5 {
        match std::fs::remove_dir_all(path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt < 4 {
                    std::thread::sleep(std::time::Duration::from_millis(150 * (attempt + 1)));
                }
            }
        }
    }
    Err(last_err.unwrap())
}

/// Renames a version directory (e.g. moving `v4/` to `v3/` when v3 was just
/// deleted and everything above it shifts down), retrying a few times since
/// Windows can briefly hold a lock on a file that was written moments ago.
pub fn rename_dir_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut last_err = None;
    for attempt in 0..5 {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt < 4 {
                    std::thread::sleep(std::time::Duration::from_millis(150 * (attempt + 1)));
                }
            }
        }
    }
    Err(last_err.unwrap())
}

/// Relocates the entire storage root (database, projects, backups, logs) to
/// a new location - Settings -> Storage -> "Change". Tries a plain rename
/// first, which is atomic and instant when both paths sit on the same
/// filesystem; only falls back to a full recursive copy-then-delete when
/// that's impossible, which is the normal case for "move to a different
/// drive" (an external disk, a different internal volume, ...) since a
/// rename can never cross filesystems.
///
/// If `to` already exists (the user picked an existing empty folder rather
/// than typing a brand-new name) its contents are moved into it entry by
/// entry instead of renaming the root itself, since `rename` can't target a
/// directory that's already there. The caller is responsible for having
/// already confirmed `to` is empty or absent, and for having released any
/// open handle on `from` (the SQLite connection) before calling this.
pub fn move_storage_root(from: &Path, to: &Path) -> AppResult<()> {
    if to.exists() {
        for entry in std::fs::read_dir(from)? {
            let entry = entry?;
            let dest = to.join(entry.file_name());
            move_path(&entry.path(), &dest)?;
        }
        remove_dir_all_if_exists(from)?;
    } else {
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent)?;
        }
        move_path(from, to)?;
    }
    Ok(())
}

fn move_path(from: &Path, to: &Path) -> AppResult<()> {
    match std::fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(e) if is_cross_device(&e) => {
            copy_recursive(from, to)?;
            remove_dir_all_if_exists(from).map_err(|e| {
                AppError::with_details(
                    "The data was copied to the new location, but the old copy couldn't be removed automatically - you can delete it by hand.",
                    e,
                )
            })
        }
        Err(e) => Err(AppError::with_details("Unable to move the storage folder.", e)),
    }
}

/// `rename(2)`/`MoveFile` refuse to cross filesystem boundaries (moving to a
/// different drive or a different mounted volume) - checked via the raw OS
/// error code rather than `ErrorKind` since a portable "crosses devices"
/// variant isn't available on stable Rust for this MSRV.
fn is_cross_device(e: &std::io::Error) -> bool {
    match e.raw_os_error() {
        Some(18) if cfg!(unix) => true,    // EXDEV
        Some(17) if cfg!(windows) => true, // ERROR_NOT_SAME_DEVICE
        _ => false,
    }
}

fn copy_recursive(from: &Path, to: &Path) -> AppResult<()> {
    std::fs::create_dir_all(to)?;
    for entry in walkdir::WalkDir::new(from) {
        let entry = entry.map_err(|e| AppError::with_details("Unable to read the storage folder.", e))?;
        let rel = entry
            .path()
            .strip_prefix(from)
            .expect("WalkDir yields paths nested under `from`");
        let dest = to.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

/// Removes any leftover partial uploads from `temp/`. Called once on
/// startup (spec section 66/97) - anything found here means the app closed
/// or crashed mid-upload, and no DB row references it.
pub fn cleanup_temp_dir(temp_dir: &Path) -> std::io::Result<()> {
    if !temp_dir.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(temp_dir)?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let _ = std::fs::remove_dir_all(&path);
        } else {
            let _ = std::fs::remove_file(&path);
        }
    }
    Ok(())
}

/// Human-readable file size, e.g. "1.4 MB" (spec section 51).
pub fn human_size(bytes: i64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let mut value = bytes as f64;
    let mut unit_index = 0;
    while value >= 1024.0 && unit_index < UNITS.len() - 1 {
        value /= 1024.0;
        unit_index += 1;
    }
    format!("{value:.1} {}", UNITS[unit_index])
}

/// Best-effort MIME type from the file extension. Purely informational (used
/// for preview-support hints); never used to decide execution behavior.
pub fn guess_mime_type(filename: &str) -> Option<String> {
    let ext = Path::new(filename)
        .extension()?
        .to_str()?
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "txt" | "md" | "csv" | "log" => "text/plain",
        "json" => "application/json",
        "xml" => "application/xml",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" | "ts" => "text/javascript",
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "zip" => "application/zip",
        "rar" => "application/vnd.rar",
        "7z" => "application/x-7z-compressed",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "psd" => "image/vnd.adobe.photoshop",
        "ai" => "application/postscript",
        "fig" => "application/octet-stream",
        "iso" => "application/x-iso9660-image",
        "exe" => "application/vnd.microsoft.portable-executable",
        "dmg" => "application/x-apple-diskimage",
        _ => "application/octet-stream",
    };
    Some(mime.to_string())
}
