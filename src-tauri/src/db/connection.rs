use rusqlite::{Connection, Result as SqlResult};
use std::path::{Path, PathBuf};

use super::schema::{create_tables, run_migrations};

fn default_app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir()))
        .join("Agent Assets Manager")
}

pub fn default_db_path() -> PathBuf {
    default_app_data_dir().join("data.db")
}

pub fn default_trash_path() -> PathBuf {
    default_app_data_dir().join("Trash")
}

pub fn get_db_connection_at_path(db_path: &Path) -> SqlResult<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(db_path)?;
    create_tables(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

pub fn get_db_connection() -> SqlResult<Connection> {
    get_db_connection_at_path(&default_db_path())
}
