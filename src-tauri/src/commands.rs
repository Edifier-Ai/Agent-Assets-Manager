use serde::{Deserialize, Serialize};
use crate::db;
use crate::db::get_db_connection;
use crate::scanner;
use crate::operations;
use crate::platform::detect_all_platforms;

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    fn err(msg: String) -> Self {
        Self { success: false, data: None, error: Some(msg) }
    }
}

#[tauri::command]
pub fn scan_platforms() -> ApiResponse<Vec<db::Platform>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let now = chrono::Utc::now().to_rfc3339();
    
    for dp in detect_all_platforms() {
        let platform = db::Platform {
            id: dp.id.clone(),
            name: dp.kind.display_name().to_string(),
            kind: dp.kind.as_str().to_string(),
            cli_path: dp.cli_path.clone(),
            version: dp.version.clone(),
            config_roots: dp.config_roots.clone(),
            writable: dp.writable.clone(),
            detected_at: now.clone(),
            status: dp.status.clone(),
            asset_count: dp.asset_count,
            warning_count: dp.warning_count,
        };
        if let Err(e) = db::insert_platform(&conn, &platform) {
            return ApiResponse::err(e.to_string());
        }
    }
    
    match db::get_all_platforms(&conn) {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn scan_assets() -> ApiResponse<scanner::ScanResult> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    
    match scanner::run_full_scan(&conn) {
        Ok(result) => ApiResponse::ok(result),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_platforms() -> ApiResponse<Vec<db::Platform>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_platforms(&conn) {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_assets() -> ApiResponse<Vec<db::Asset>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_assets(&conn) {
        Ok(a) => ApiResponse::ok(a),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_model_bindings() -> ApiResponse<Vec<db::ModelBinding>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_model_bindings(&conn) {
        Ok(m) => ApiResponse::ok(m),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_model_profiles() -> ApiResponse<Vec<db::ModelProfile>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_model_profiles(&conn) {
        Ok(profiles) => ApiResponse::ok(profiles),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_backups() -> ApiResponse<Vec<db::Backup>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_backups(&conn) {
        Ok(b) => ApiResponse::ok(b),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_findings() -> ApiResponse<Vec<db::Finding>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_findings(&conn) {
        Ok(f) => ApiResponse::ok(f),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_scan_runs() -> ApiResponse<Vec<db::ScanRun>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_scan_runs(&conn) {
        Ok(r) => ApiResponse::ok(r),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[derive(Serialize, Deserialize)]
pub struct AssetDetailRequest {
    pub asset_id: String,
}

#[tauri::command]
pub fn get_asset_detail(request: AssetDetailRequest) -> ApiResponse<db::Asset> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_assets(&conn) {
        Ok(assets) => {
            match assets.into_iter().find(|a| a.id == request.asset_id) {
                Some(a) => ApiResponse::ok(a),
                None => ApiResponse::err("Asset not found".to_string()),
            }
        }
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn preview_operation(
    request: operations::PreviewOperationRequest,
) -> ApiResponse<operations::OperationPreview> {
    match operations::preview_operation(request) {
        Ok(preview) => ApiResponse::ok(preview),
        Err(e) => ApiResponse::err(e),
    }
}

#[tauri::command]
pub fn execute_operation(
    request: operations::ExecuteOperationRequest,
) -> ApiResponse<operations::OperationExecutionResult> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };

    match operations::execute_operation(&conn, request) {
        Ok(result) => ApiResponse::ok(result),
        Err(e) => ApiResponse::err(e),
    }
}

#[tauri::command]
pub fn get_settings() -> ApiResponse<db::AppSettings> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let context = default_settings_context();

    match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(settings) => ApiResponse::ok(settings),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[derive(Serialize, Deserialize)]
pub struct SaveSettingsRequest {
    pub theme: String,
    pub include_project_local: bool,
    pub enable_deep_scan: bool,
}

struct SettingsContext {
    scan_paths: Vec<String>,
    db_location: String,
    trash_location: String,
}

fn default_settings_context() -> SettingsContext {
    let home = dirs::home_dir().unwrap_or_default();

    SettingsContext {
        scan_paths: vec![
            home.join(".codex").to_string_lossy().to_string(),
            home.join(".claude").to_string_lossy().to_string(),
            home.join(".opencode").to_string_lossy().to_string(),
            home.join(".hermes").to_string_lossy().to_string(),
            home.join(".openclaw").to_string_lossy().to_string(),
        ],
        db_location: db::default_db_path().to_string_lossy().to_string(),
        trash_location: db::default_trash_path().to_string_lossy().to_string(),
    }
}

fn merge_save_settings_request(
    current: db::AppSettings,
    request: SaveSettingsRequest,
) -> db::AppSettings {
    db::AppSettings {
        scan_paths: current.scan_paths,
        include_project_local: request.include_project_local,
        enable_deep_scan: request.enable_deep_scan,
        db_location: current.db_location,
        trash_location: current.trash_location,
        theme: request.theme,
        security_level: current.security_level,
    }
}

#[tauri::command]
pub fn save_settings(request: SaveSettingsRequest) -> ApiResponse<String> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let context = default_settings_context();

    let current = match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(settings) => settings,
        Err(e) => return ApiResponse::err(e.to_string()),
    };

    let merged = merge_save_settings_request(current, request);
    match db::save_settings(&conn, &merged) {
        Ok(()) => ApiResponse::ok("Settings saved".to_string()),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_save_settings_request_preserves_non_editable_fields() {
        let current = db::AppSettings {
            scan_paths: vec!["/Users/test/.codex".to_string()],
            include_project_local: true,
            enable_deep_scan: false,
            db_location: "/tmp/data.db".to_string(),
            trash_location: "/tmp/Trash".to_string(),
            theme: "system".to_string(),
            security_level: "strict".to_string(),
        };
        let request = SaveSettingsRequest {
            theme: "dark".to_string(),
            include_project_local: false,
            enable_deep_scan: true,
        };

        let merged = merge_save_settings_request(current, request);

        assert_eq!(merged.scan_paths, vec!["/Users/test/.codex".to_string()]);
        assert_eq!(merged.db_location, "/tmp/data.db");
        assert_eq!(merged.trash_location, "/tmp/Trash");
        assert_eq!(merged.security_level, "strict");
        assert_eq!(merged.theme, "dark");
        assert!(!merged.include_project_local);
        assert!(merged.enable_deep_scan);
    }
}
