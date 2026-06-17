use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Platform {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub cli_path: Option<String>,
    pub version: Option<String>,
    pub config_roots: Vec<String>,
    pub writable: String,
    pub detected_at: String,
    pub status: String,
    pub asset_count: i32,
    pub warning_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub asset_type: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub source: String,
    pub canonical_hash: Option<String>,
    pub directory_hash: Option<String>,
    pub risk_level: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub installations: Vec<Installation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Installation {
    pub id: String,
    pub asset_id: String,
    pub platform_id: String,
    pub platform_name: String,
    pub path: String,
    pub scope: String,
    pub enabled: bool,
    pub official: bool,
    pub project_local: bool,
    pub binding_type: String,
    pub content_hash: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelBinding {
    pub id: String,
    pub platform_id: String,
    pub platform_name: String,
    pub detected_provider: String,
    pub detected_model_id: String,
    pub detected_base_url: Option<String>,
    pub config_path: String,
    pub key_presence: bool,
    pub key_storage: String,
    pub key_suffix: Option<String>,
    pub validation_status: String,
    pub last_validated_at: Option<String>,
    pub warnings: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Backup {
    pub id: String,
    pub operation_id: String,
    pub operation_type: String,
    pub original_path: String,
    pub backup_path: String,
    pub hash: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub operation_type: String,
    pub status: String,
    pub target_type: String,
    pub target_id: Option<String>,
    pub target_path: Option<String>,
    pub preview_json: Option<String>,
    pub result_json: Option<String>,
    pub backup_id: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub asset_id: String,
    pub asset_name: String,
    pub platform_id: String,
    pub platform_name: String,
    pub issue: String,
    pub risk_level: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanRun {
    pub id: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub status: String,
    pub platforms_found: i32,
    pub assets_found: i32,
    pub duplicates_found: i32,
    pub warnings_found: i32,
    #[serde(default)]
    pub steps: Vec<ScanStep>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanStep {
    pub id: String,
    pub scan_run_id: String,
    pub step_key: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub detail: Option<String>,
    pub order_index: i32,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub scan_paths: Vec<String>,
    pub include_project_local: bool,
    pub enable_deep_scan: bool,
    pub db_location: String,
    pub trash_location: String,
    pub theme: String,
    pub security_level: String,
    pub ignored_platform_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProfile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model_id: String,
    pub base_url: String,
    pub key_storage: String,
    pub env_key_names: Vec<String>,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}
