use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("TOML error: {0}")]
    Toml(#[from] toml::de::Error),

    #[error("Scan task panicked")]
    ScanPanicked,

    #[error("Asset not found: {0}")]
    AssetNotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("{0}")]
    Other(String),
}

#[derive(Debug, Serialize)]
pub struct ErrorPayload {
    pub code: &'static str,
    pub message: String,
}

impl AppError {
    pub fn to_payload(&self) -> ErrorPayload {
        let code = match self {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Io(_) => "IO_ERROR",
            AppError::Json(_) => "JSON_ERROR",
            AppError::Yaml(_) => "YAML_ERROR",
            AppError::Toml(_) => "TOML_ERROR",
            AppError::ScanPanicked => "SCAN_PANIC",
            AppError::AssetNotFound(_) => "NOT_FOUND",
            AppError::InvalidPath(_) => "INVALID_PATH",
            AppError::Other(_) => "UNKNOWN_ERROR",
        };
        ErrorPayload {
            code,
            message: self.to_string(),
        }
    }
}
