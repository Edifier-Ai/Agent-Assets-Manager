use crate::db;
use crate::db::get_db_connection;
use crate::error::AppError;
use crate::operations;
use crate::scanner;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ErrorPayload>,
}

impl<T> ApiResponse<T> {
    fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    fn err(error: AppError) -> Self {
        let payload = error.to_payload();
        Self {
            success: false,
            data: None,
            error: Some(ErrorPayload {
                code: payload.code.to_string(),
                message: payload.message,
            }),
        }
    }
}

#[tauri::command]
pub fn scan_platforms(
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> ApiResponse<Vec<db::Platform>> {
    // Check cache first — avoid re-spawning binaries within TTL
    {
        let guard = cache.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((cached_at, ref platforms)) = *guard {
            if cached_at.elapsed() < crate::platform::CACHE_TTL {
                return ApiResponse::ok(platforms.clone());
            }
        }
    }

    // Cache miss — detect and persist
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    let now = chrono::Utc::now().to_rfc3339();

    let detected = crate::platform::detect_all_platforms();
    let mut db_platforms: Vec<db::Platform> = Vec::new();

    for dp in detected {
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
            return ApiResponse::err(AppError::from(e));
        }
        db_platforms.push(platform);
    }

    // Populate cache from the authoritative DB read (includes pre-existing platforms)
    match db::get_all_platforms(&conn) {
        Ok(all_platforms) => {
            let mut guard = cache.inner.lock().unwrap_or_else(|e| e.into_inner());
            *guard = Some((std::time::Instant::now(), all_platforms.clone()));
            ApiResponse::ok(all_platforms)
        }
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub async fn scan_assets(
    request: Option<ScanAssetsRequest>,
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> Result<ApiResponse<scanner::ScanResult>, String> {
    let request = request.unwrap_or_default();
    let scan_roots_raw = request.scan_roots.unwrap_or_default();

    // Read settings synchronously before spawning (fast DB call)
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return Ok(ApiResponse::err(AppError::from(e))),
    };
    let context = default_settings_context();
    let settings = match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(s) => s,
        Err(e) => return Ok(ApiResponse::err(AppError::from(e))),
    };

    let explicit_roots = sanitize_paths(scan_roots_raw, Vec::new());
    let scan_roots = if explicit_roots.is_empty() && settings.enable_deep_scan {
        settings.scan_paths
    } else {
        explicit_roots
    };

    // Offload blocking WalkDir + hashing work to a thread-pool thread.
    // Map errors to String inside the closure so the return type is Send + 'static.
    let result = tokio::task::spawn_blocking(move || {
        let conn = get_db_connection().map_err(|e| e.to_string())?;
        if scan_roots.is_empty() {
            scanner::run_full_scan(&conn).map_err(|e| e.to_string())
        } else {
            scanner::run_full_scan_with_extra_roots(&conn, scan_roots).map_err(|e| e.to_string())
        }
    })
    .await;

    Ok(match result {
        Ok(Ok(scan_result)) => {
            // Invalidate platform cache so next scan_platforms reflects fresh data
            cache.invalidate();
            ApiResponse::ok(scan_result)
        }
        Ok(Err(e)) => ApiResponse::err(AppError::Other(e)),
        Err(_join_err) => ApiResponse::err(AppError::ScanPanicked),
    })
}

#[tauri::command]
pub fn get_platforms() -> ApiResponse<Vec<db::Platform>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_platforms(&conn) {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_assets() -> ApiResponse<Vec<db::Asset>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_assets(&conn) {
        Ok(a) => ApiResponse::ok(a),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_model_bindings() -> ApiResponse<Vec<db::ModelBinding>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_model_bindings(&conn) {
        Ok(m) => ApiResponse::ok(m),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_model_profiles() -> ApiResponse<Vec<db::ModelProfile>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_model_profiles(&conn) {
        Ok(profiles) => ApiResponse::ok(profiles),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_backups() -> ApiResponse<Vec<db::Backup>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_backups(&conn) {
        Ok(b) => ApiResponse::ok(b),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_operation_logs() -> ApiResponse<Vec<db::OperationLog>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_operation_logs(&conn) {
        Ok(logs) => ApiResponse::ok(logs),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_findings() -> ApiResponse<Vec<db::Finding>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_findings(&conn) {
        Ok(f) => ApiResponse::ok(f),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn get_scan_runs() -> ApiResponse<Vec<db::ScanRun>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_all_scan_runs(&conn) {
        Ok(r) => ApiResponse::ok(r),
        Err(e) => ApiResponse::err(AppError::from(e)),
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
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    match db::get_asset_by_id(&conn, &request.asset_id) {
        Ok(Some(asset)) => ApiResponse::ok(asset),
        Ok(None) => ApiResponse::err(AppError::AssetNotFound(request.asset_id.clone())),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[tauri::command]
pub fn preview_operation(
    request: operations::PreviewOperationRequest,
) -> ApiResponse<operations::OperationPreview> {
    match operations::preview_operation(request) {
        Ok(preview) => ApiResponse::ok(preview),
        Err(e) => ApiResponse::err(AppError::Other(e)),
    }
}

#[tauri::command]
pub fn execute_operation(
    request: operations::ExecuteOperationRequest,
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> ApiResponse<operations::OperationExecutionResult> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    match operations::execute_operation(&conn, request) {
        Ok(result) => {
            cache.invalidate();
            ApiResponse::ok(result)
        }
        Err(e) => ApiResponse::err(AppError::Other(e)),
    }
}

#[derive(Serialize, Deserialize)]
pub struct PreviewSkillSyncRequest {
    pub asset_ids: Vec<String>,
    pub strategy: String,
    pub source_platform_id: Option<String>,
}

#[tauri::command]
pub fn preview_skill_sync_plan(
    request: PreviewSkillSyncRequest,
) -> ApiResponse<operations::BatchSyncPreview> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    let all_assets = match db::get_all_assets(&conn) {
        Ok(a) => a,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    let selected_assets: Vec<db::Asset> = all_assets
        .into_iter()
        .filter(|a| request.asset_ids.contains(&a.id))
        .collect();

    let all_platforms = match db::get_all_platforms(&conn) {
        Ok(p) => p,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    match operations::preview_skill_sync_plan(
        &selected_assets,
        &all_platforms,
        &request.strategy,
        request.source_platform_id.as_deref(),
    ) {
        Ok(preview) => ApiResponse::ok(preview),
        Err(e) => ApiResponse::err(AppError::Other(e)),
    }
}

#[tauri::command]
pub fn execute_skill_sync_plan(
    request: operations::BatchSyncRequest,
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> ApiResponse<operations::BatchSyncResult> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    match operations::execute_skill_sync_plan(&conn, request) {
        Ok(result) => {
            cache.invalidate();
            ApiResponse::ok(result)
        }
        Err(e) => ApiResponse::err(AppError::Other(e)),
    }
}

#[tauri::command]
pub fn get_settings() -> ApiResponse<db::AppSettings> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    let context = default_settings_context();

    match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(settings) => ApiResponse::ok(settings),
        Err(e) => ApiResponse::err(AppError::from(e)),
    }
}

#[derive(Serialize, Deserialize)]
pub struct SaveSettingsRequest {
    pub theme: String,
    pub scan_paths: Vec<String>,
    pub include_project_local: bool,
    pub enable_deep_scan: bool,
    pub db_location: String,
    pub trash_location: String,
    pub ignored_platform_ids: Vec<String>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct ScanAssetsRequest {
    pub scan_roots: Option<Vec<String>>,
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
            home.join("Library/Application Support/Claude")
                .to_string_lossy()
                .to_string(),
            home.join("Library/Application Support/Claude-3p")
                .to_string_lossy()
                .to_string(),
            home.join(".opencode").to_string_lossy().to_string(),
            home.join(".hermes").to_string_lossy().to_string(),
            home.join(".openclaw").to_string_lossy().to_string(),
            home.join(".kimi-code").to_string_lossy().to_string(),
            home.join(".gemini").to_string_lossy().to_string(),
            home.join(".qwen").to_string_lossy().to_string(),
            home.join(".cursor").to_string_lossy().to_string(),
            home.join(".trae").to_string_lossy().to_string(),
            home.join(".trae-cn").to_string_lossy().to_string(),
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
        scan_paths: sanitize_paths(request.scan_paths, current.scan_paths),
        include_project_local: request.include_project_local,
        enable_deep_scan: request.enable_deep_scan,
        db_location: sanitize_path(request.db_location, current.db_location),
        trash_location: sanitize_path(request.trash_location, current.trash_location),
        theme: request.theme,
        security_level: current.security_level,
        ignored_platform_ids: sanitize_platform_ids(request.ignored_platform_ids),
    }
}

fn sanitize_path(path: String, fallback: String) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return fallback;
    }

    let expanded = if trimmed.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            home.join(&trimmed[2..]).to_string_lossy().to_string()
        } else {
            trimmed.to_string()
        }
    } else {
        trimmed.to_string()
    };

    let resolved = Path::new(&expanded);
    let resolved = if resolved.is_relative() {
        return fallback;
    } else {
        resolved.to_path_buf()
    };

    let blocked_prefixes = [
        "/bin", "/sbin", "/usr", "/etc", "/var", "/sys", "/proc", "/dev",
        "/System", "/Library/Apple", "/Library/Application Support/Apple",
    ];
    for prefix in &blocked_prefixes {
        if resolved.starts_with(prefix) {
            return fallback;
        }
    }

    expanded
}

fn sanitize_paths(paths: Vec<String>, fallback: Vec<String>) -> Vec<String> {
    let mut cleaned = paths
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();
    cleaned.sort();
    cleaned.dedup();

    if cleaned.is_empty() {
        fallback
    } else {
        cleaned
    }
}

fn sanitize_platform_ids(ids: Vec<String>) -> Vec<String> {
    let mut cleaned = ids
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();
    cleaned.sort();
    cleaned.dedup();
    cleaned
}

#[tauri::command]
pub fn save_settings(request: SaveSettingsRequest) -> ApiResponse<String> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };
    let context = default_settings_context();

    let current = match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(settings) => settings,
        Err(e) => return ApiResponse::err(AppError::from(e)),
    };

    let merged = merge_save_settings_request(current, request);
    match db::save_settings(&conn, &merged) {
        Ok(()) => ApiResponse::ok("Settings saved".to_string()),
        Err(e) => ApiResponse::err(AppError::from(e)),
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
            ignored_platform_ids: vec!["claude-app".to_string()],
        };
        let request = SaveSettingsRequest {
            theme: "dark".to_string(),
            scan_paths: current.scan_paths.clone(),
            include_project_local: false,
            enable_deep_scan: true,
            db_location: current.db_location.clone(),
            trash_location: current.trash_location.clone(),
            ignored_platform_ids: vec!["trae".to_string()],
        };

        let merged = merge_save_settings_request(current, request);

        assert_eq!(merged.scan_paths, vec!["/Users/test/.codex".to_string()]);
        assert_eq!(merged.db_location, "/tmp/data.db");
        assert_eq!(merged.trash_location, "/tmp/Trash");
        assert_eq!(merged.security_level, "strict");
        assert_eq!(merged.theme, "dark");
        assert_eq!(merged.ignored_platform_ids, vec!["trae".to_string()]);
        assert!(!merged.include_project_local);
        assert!(merged.enable_deep_scan);
    }

    #[test]
    fn merge_save_settings_request_updates_editable_paths_and_locations() {
        let current = db::AppSettings {
            scan_paths: vec!["/Users/test/.codex".to_string()],
            include_project_local: true,
            enable_deep_scan: false,
            db_location: "/tmp/data.db".to_string(),
            trash_location: "/tmp/Trash".to_string(),
            theme: "system".to_string(),
            security_level: "strict".to_string(),
            ignored_platform_ids: Vec::new(),
        };
        let request = SaveSettingsRequest {
            theme: "light".to_string(),
            scan_paths: vec![
                "/Users/test/.codex".to_string(),
                "/Users/test/Projects".to_string(),
            ],
            include_project_local: false,
            enable_deep_scan: true,
            db_location: "/Users/test/Data/agent-assets.db".to_string(),
            trash_location: "/Users/test/.Trash/Agent Assets Manager".to_string(),
            ignored_platform_ids: vec![
                "claude-app".to_string(),
                "claude-app".to_string(),
                " ".to_string(),
            ],
        };

        let merged = merge_save_settings_request(current, request);

        assert_eq!(
            merged.scan_paths,
            vec![
                "/Users/test/.codex".to_string(),
                "/Users/test/Projects".to_string()
            ]
        );
        assert_eq!(merged.db_location, "/Users/test/Data/agent-assets.db");
        assert_eq!(
            merged.trash_location,
            "/Users/test/.Trash/Agent Assets Manager"
        );
        assert_eq!(merged.theme, "light");
        assert!(!merged.include_project_local);
        assert!(merged.enable_deep_scan);
        assert_eq!(merged.security_level, "strict");
        assert_eq!(merged.ignored_platform_ids, vec!["claude-app".to_string()]);
    }
}
