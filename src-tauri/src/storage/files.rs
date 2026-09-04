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
