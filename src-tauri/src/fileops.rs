use crate::db::Backup;
use chrono::Utc;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub struct FileMutationResult {
    pub destination_path: String,
    pub backup: Backup,
}

pub fn get_trash_dir() -> PathBuf {
    let trash = dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir()))
        .join("Agent Assets Manager")
        .join("Trash");
    fs::create_dir_all(&trash).ok();
    trash
}

pub fn get_backup_dir() -> PathBuf {
    let backup = dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir()))
        .join("Agent Assets Manager")
        .join("Backups");
    fs::create_dir_all(&backup).ok();
    backup
}

fn expand_home(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        dirs::home_dir()
            .map(|h| h.join(&path[2..]))
            .unwrap_or_else(|| PathBuf::from(path))
    } else {
        PathBuf::from(path)
    }
}

pub fn move_to_trash_with_operation(
    conn: &Connection,
    path_str: &str,
    operation_id: &str,
) -> Result<FileMutationResult, String> {
    let src = expand_home(path_str);
    if !src.exists() {
        return Err(format!("路径不存在: {}", path_str));
    }
    let trash = get_trash_dir();
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let dest = unique_destination(&trash, &format!("{}-{}", name, timestamp));

    move_by_copy_then_remove(&src, &dest)?;

    // Record in database
    let hash = sha256_file(&dest);
    let backup = Backup {
        id: format!(
            "backup-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ),
        operation_id: operation_id.to_string(),
        operation_type: "delete".to_string(),
        original_path: path_str.to_string(),
        backup_path: dest.to_string_lossy().to_string(),
        hash,
        created_at: Utc::now().to_rfc3339(),
    };
    crate::db::insert_backup(conn, &backup).map_err(|e| e.to_string())?;

    Ok(FileMutationResult {
        destination_path: dest.to_string_lossy().to_string(),
        backup,
    })
}

pub fn create_backup(path_str: &str) -> Result<String, String> {
    let src = expand_home(path_str);
    if !src.exists() {
        return Err(format!("路径不存在: {}", path_str));
    }
    let backup_dir = get_backup_dir();
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let dest = unique_destination(&backup_dir, &format!("{}-backup-{}", name, timestamp));

    if src.is_dir() {
        copy_dir_all(&src, &dest).map_err(|e| e.to_string())?;
    } else {
        fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    }

    Ok(dest.to_string_lossy().to_string())
}

pub fn restore_from_backup(backup_path: &str, original_path: &str) -> Result<(), String> {
    let backup = PathBuf::from(backup_path);
    let original = expand_home(original_path);

    if !backup.exists() {
        return Err("备份文件不存在".to_string());
    }

    if backup.is_dir() {
        if original.exists() {
            fs::remove_dir_all(&original).map_err(|e| e.to_string())?;
        }
        copy_dir_all(&backup, &original).map_err(|e| e.to_string())?;
    } else {
        fs::copy(&backup, &original).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn unique_destination(parent: &Path, base_name: &str) -> PathBuf {
    let mut candidate = parent.join(base_name);
    let mut suffix = 1;

    while candidate.exists() {
        candidate = parent.join(format!("{base_name}-{suffix}"));
        suffix += 1;
    }

    candidate
}

fn move_by_copy_then_remove(src: &Path, dest: &Path) -> Result<(), String> {
    if src.is_dir() {
        copy_dir_all(src, dest).map_err(|e| e.to_string())?;
        if let Err(error) = fs::remove_dir_all(src) {
            let _ = fs::remove_dir_all(dest);
            return Err(error.to_string());
        }
    } else {
        fs::copy(src, dest).map_err(|e| e.to_string())?;
        if let Err(error) = fs::remove_file(src) {
            let _ = fs::remove_file(dest);
            return Err(error.to_string());
        }
    }

    Ok(())
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn sha256_file(path: &Path) -> String {
    match fs::read(path) {
        Ok(data) => {
            let mut hasher = Sha256::new();
            hasher.update(&data);
            hex::encode(hasher.finalize())
        }
        Err(_) => String::new(),
    }
}

pub fn disable_asset_with_operation(
    conn: &Connection,
    path_str: &str,
    operation_id: &str,
) -> Result<FileMutationResult, String> {
    let src = expand_home(path_str);
    if !src.exists() {
        return Err(format!("路径不存在: {}", path_str));
    }

    let disabled_dir = dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir()))
        .join("Agent Assets Manager")
        .join("Disabled");
    fs::create_dir_all(&disabled_dir).ok();

    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let dest = unique_destination(&disabled_dir, &format!("{}-disabled-{}", name, timestamp));

    move_by_copy_then_remove(&src, &dest)?;

    // Record backup
    let hash = sha256_file(&dest);
    let backup = crate::db::Backup {
        id: format!(
            "backup-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ),
        operation_id: operation_id.to_string(),
        operation_type: "disable".to_string(),
        original_path: path_str.to_string(),
        backup_path: dest.to_string_lossy().to_string(),
        hash,
        created_at: Utc::now().to_rfc3339(),
    };
    crate::db::insert_backup(conn, &backup).map_err(|e| e.to_string())?;

    Ok(FileMutationResult {
        destination_path: dest.to_string_lossy().to_string(),
        backup,
    })
}

pub fn is_sensitive_file(path: &str) -> bool {
    let lower = Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_lowercase();
    lower.ends_with(".env")
        || lower.contains("secret")
        || lower.contains("private")
        || lower.contains("token")
        || lower.contains("credential")
        || lower.ends_with(".key")
        || lower.ends_with(".pem")
        || lower.ends_with(".p12")
}
