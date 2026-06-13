use std::fs;
use std::path::Path;

use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{adapters, db, fileops, platform::PlatformKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewOperationRequest {
    pub operation_type: String,
    pub target_id: Option<String>,
    pub target_name: String,
    pub target_type: String,
    pub target_path: String,
    pub source_path: Option<String>,
    pub official: bool,
    pub risk_level: Option<String>,
    pub platform_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationPreview {
    pub operation_type: String,
    pub target_id: Option<String>,
    pub target_name: String,
    pub target_type: String,
    pub target_path: String,
    pub source_path: Option<String>,
    pub supported: bool,
    pub files_to_modify: Vec<String>,
    pub files_to_move: Vec<String>,
    pub backup_paths: Vec<String>,
    pub written_keys: Vec<String>,
    pub needs_restart: bool,
    pub risks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteOperationRequest {
    pub preview: PreviewOperationRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationExecutionResult {
    pub operation_id: String,
    pub operation_type: String,
    pub target_id: Option<String>,
    pub target_path: String,
    pub outcome_path: Option<String>,
    pub backup_id: Option<String>,
    pub message: String,
}

pub fn preview_operation(request: PreviewOperationRequest) -> Result<OperationPreview, String> {
    if request.operation_type == "delete" && request.official {
        return Ok(OperationPreview {
            operation_type: request.operation_type,
            target_id: request.target_id,
            target_name: request.target_name,
            target_type: request.target_type,
            target_path: request.target_path,
            source_path: request.source_path,
            supported: false,
            files_to_modify: Vec::new(),
            files_to_move: Vec::new(),
            backup_paths: Vec::new(),
            written_keys: Vec::new(),
            needs_restart: false,
            risks: vec!["官方或内置资产不可直接移入回收站".to_string()],
        });
    }

    if request.operation_type == "apply-model-profile" {
        return preview_apply_model_profile_request(&request);
    }

    let mut files_to_modify = Vec::new();
    let mut files_to_move = Vec::new();
    let mut backup_paths = Vec::new();
    let mut written_keys = Vec::new();
    let mut risks = Vec::new();
    let mut needs_restart = false;

    match request.operation_type.as_str() {
        "install-asset" => {
            let source_path = request
                .source_path
                .clone()
                .ok_or_else(|| "安装资产缺少源路径".to_string())?;
            let platform_id = request
                .platform_id
                .clone()
                .ok_or_else(|| "安装资产缺少目标平台".to_string())?;
            let kind = PlatformKind::from_str(&platform_id)
                .ok_or_else(|| format!("Unknown platform id: {platform_id}"))?;
            let adapter = adapters::adapter_for_kind(&kind);
            if adapter.writable_status() == "readonly" {
                return Ok(OperationPreview {
                    operation_type: request.operation_type,
                    target_id: request.target_id,
                    target_name: request.target_name,
                    target_type: request.target_type.clone(),
                    target_path: request.target_path,
                    source_path: request.source_path,
                    supported: false,
                    files_to_modify: Vec::new(),
                    files_to_move: Vec::new(),
                    backup_paths: Vec::new(),
                    written_keys: Vec::new(),
                    needs_restart: false,
                    risks: vec!["目标平台当前为只读，不支持直接安装资产".to_string()],
                });
            }
            if !adapter
                .asset_search_specs()
                .iter()
                .any(|spec| spec.asset_type == request.target_type)
            {
                return Ok(OperationPreview {
                    operation_type: request.operation_type,
                    target_id: request.target_id,
                    target_name: request.target_name,
                    target_type: request.target_type.clone(),
                    target_path: request.target_path,
                    source_path: request.source_path,
                    supported: false,
                    files_to_modify: Vec::new(),
                    files_to_move: Vec::new(),
                    backup_paths: Vec::new(),
                    written_keys: Vec::new(),
                    needs_restart: false,
                    risks: vec![format!(
                        "目标平台不支持安装 {} 类型资产",
                        request.target_type
                    )],
                });
            }
            files_to_modify.push(request.target_path.clone());
            files_to_move.push(source_path);
            backup_paths.push(request.target_path.clone());
            written_keys.push(format!("installation:{platform_id}"));
            risks.push("如果目标路径已存在，将先创建覆盖前备份".to_string());
            needs_restart = true;
        }
        "delete" => {
            files_to_move.push(request.target_path.clone());
            backup_paths.push("Agent Assets Manager/Trash".to_string());
            risks.push("将创建备份记录".to_string());
        }
        "disable" => {
            files_to_move.push(request.target_path.clone());
            backup_paths.push("Agent Assets Manager/Disabled".to_string());
            written_keys.push("enabled".to_string());
        }
        "restore" => {
            files_to_modify.push(request.target_path.clone());
            if let Some(source_path) = request.source_path.clone() {
                files_to_modify.push(source_path);
            }
            risks.push("如果原路径已存在内容，将先创建恢复前备份".to_string());
        }
        other => return Err(format!("Unsupported operation type: {other}")),
    }

    Ok(OperationPreview {
        operation_type: request.operation_type,
        target_id: request.target_id,
        target_name: request.target_name,
        target_type: request.target_type,
        target_path: request.target_path,
        source_path: request.source_path,
        supported: true,
        files_to_modify,
        files_to_move,
        backup_paths,
        written_keys,
        needs_restart,
        risks,
    })
}

fn preview_apply_model_profile_request(
    request: &PreviewOperationRequest,
) -> Result<OperationPreview, String> {
    let platform_id = request
        .platform_id
        .as_deref()
        .ok_or_else(|| "Applying a model profile requires platform_id".to_string())?;
    let kind = PlatformKind::from_str(platform_id)
        .ok_or_else(|| format!("Unknown platform id: {platform_id}"))?;
    let adapter = adapters::adapter_for_kind(&kind);
    let target_format = config_format_for_path(&request.target_path);
    let model_config_files = adapter.model_config_files();

    if adapter.writable_status() == "readonly" || model_config_files.is_empty() {
        return Ok(OperationPreview {
            operation_type: "apply-model-profile".to_string(),
            target_id: request.target_id.clone(),
            target_name: request.target_name.clone(),
            target_type: request.target_type.clone(),
            target_path: request.target_path.clone(),
            source_path: request.source_path.clone(),
            supported: false,
            files_to_modify: Vec::new(),
            files_to_move: Vec::new(),
            backup_paths: Vec::new(),
            written_keys: Vec::new(),
            needs_restart: false,
            risks: vec!["该平台当前为只读，不支持应用模型配置".to_string()],
        });
    }

    let Some(config_spec) = model_config_files
        .iter()
        .find(|config| Some(config.format) == target_format.as_deref())
    else {
        let declared = model_config_files
            .iter()
            .map(|config| config.format)
            .collect::<Vec<_>>()
            .join(", ");
        return Ok(OperationPreview {
            operation_type: "apply-model-profile".to_string(),
            target_id: request.target_id.clone(),
            target_name: request.target_name.clone(),
            target_type: request.target_type.clone(),
            target_path: request.target_path.clone(),
            source_path: request.source_path.clone(),
            supported: false,
            files_to_modify: Vec::new(),
            files_to_move: Vec::new(),
            backup_paths: Vec::new(),
            written_keys: Vec::new(),
            needs_restart: false,
            risks: vec![format!(
                "目标格式未由 adapter 声明支持，可写格式: {declared}"
            )],
        });
    };

    Ok(OperationPreview {
        operation_type: "apply-model-profile".to_string(),
        target_id: request.target_id.clone(),
        target_name: request.target_name.clone(),
        target_type: request.target_type.clone(),
        target_path: request.target_path.clone(),
        source_path: request.source_path.clone(),
        supported: true,
        files_to_modify: vec![request.target_path.clone()],
        files_to_move: Vec::new(),
        backup_paths: vec![request.target_path.clone()],
        written_keys: config_spec
            .writable_keys
            .iter()
            .map(|key| key.to_string())
            .collect(),
        needs_restart: true,
        risks: vec![format!(
            "将按 adapter 声明以 {} 策略合并平台模型配置",
            config_spec.merge_strategy
        )],
    })
}

pub fn execute_operation(
    conn: &Connection,
    request: ExecuteOperationRequest,
) -> Result<OperationExecutionResult, String> {
    let preview = preview_operation(request.preview.clone())?;
    if !preview.supported {
        return Err(preview
            .risks
            .first()
            .cloned()
            .unwrap_or_else(|| "当前操作不受支持".to_string()));
    }

    let operation_id = format!(
        "op-{}-{}",
        preview.operation_type,
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    );

    let execution_result = match preview.operation_type.as_str() {
        "delete" => {
            let result =
                fileops::move_to_trash_with_operation(conn, &preview.target_path, &operation_id)?;
            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(result.destination_path),
                backup_id: Some(result.backup.id),
                message: "已移入回收站".to_string(),
            }
        }
        "disable" => {
            let result =
                fileops::disable_asset_with_operation(conn, &preview.target_path, &operation_id)?;
            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(result.destination_path),
                backup_id: Some(result.backup.id),
                message: "已禁用资产".to_string(),
            }
        }
        "restore" => {
            let backup_path = preview
                .source_path
                .clone()
                .ok_or_else(|| "恢复操作缺少备份路径".to_string())?;
            let backup =
                backup_existing_target(conn, &preview.target_path, &operation_id, "restore")?;
            fileops::restore_from_backup(&backup_path, &preview.target_path)?;
            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(preview.target_path.clone()),
                backup_id: backup.as_ref().map(|entry| entry.id.clone()),
                message: "已恢复备份".to_string(),
            }
        }
        "install-asset" => {
            let source_path = preview
                .source_path
                .clone()
                .ok_or_else(|| "安装资产缺少源路径".to_string())?;
            let platform_id = request
                .preview
                .platform_id
                .clone()
                .ok_or_else(|| "安装资产缺少目标平台".to_string())?;
            let backup =
                backup_existing_target(conn, &preview.target_path, &operation_id, "install-asset")?;
            fileops::copy_asset_to_target(&source_path, &preview.target_path)?;
            record_asset_installation(
                conn,
                preview
                    .target_id
                    .as_deref()
                    .ok_or_else(|| "安装资产缺少资产 id".to_string())?,
                &platform_id,
                &preview.target_path,
                &preview.target_type,
            )?;
            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(preview.target_path.clone()),
                backup_id: backup.as_ref().map(|entry| entry.id.clone()),
                message: "已安装资产".to_string(),
            }
        }
        "apply-model-profile" => {
            let profile_id = preview
                .target_id
                .clone()
                .ok_or_else(|| "应用模型配置缺少 profile id".to_string())?;
            let platform_id = request
                .preview
                .platform_id
                .clone()
                .ok_or_else(|| "应用模型配置缺少 platform_id".to_string())?;
            let profile = db::get_model_profile_by_id(conn, &profile_id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "Model profile not found".to_string())?;
            let config_spec = model_config_spec_for_target(&platform_id, &preview.target_path)?;
            let backup = backup_existing_target(
                conn,
                &preview.target_path,
                &operation_id,
                "apply-model-profile",
            )?;
            write_model_profile_to_target(&preview.target_path, &profile, &config_spec)?;
            upsert_model_binding_from_profile(conn, &platform_id, &preview.target_path, &profile)?;

            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(preview.target_path.clone()),
                backup_id: backup.as_ref().map(|entry| entry.id.clone()),
                message: "已应用模型配置".to_string(),
            }
        }
        other => return Err(format!("Unsupported operation type: {other}")),
    };

    let log = db::OperationLog {
        id: operation_id,
        operation_type: preview.operation_type.clone(),
        status: "completed".to_string(),
        target_type: preview.target_type.clone(),
        target_id: preview.target_id.clone(),
        target_path: Some(preview.target_path.clone()),
        preview_json: serde_json::to_string(&preview).ok(),
        result_json: serde_json::to_string(&execution_result).ok(),
        backup_id: execution_result.backup_id.clone(),
        created_at: Utc::now().to_rfc3339(),
        completed_at: Some(Utc::now().to_rfc3339()),
    };
    db::insert_operation(conn, &log).map_err(|e| e.to_string())?;

    Ok(execution_result)
}

fn record_asset_installation(
    conn: &Connection,
    asset_id: &str,
    platform_id: &str,
    target_path: &str,
    target_type: &str,
) -> Result<(), String> {
    let platform_name = PlatformKind::from_str(platform_id)
        .map(|kind| kind.display_name().to_string())
        .unwrap_or_else(|| platform_id.to_string());

    db::insert_installation(
        conn,
        &db::Installation {
            id: format!(
                "install-{}-{}",
                platform_id,
                Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ),
            asset_id: asset_id.to_string(),
            platform_id: platform_id.to_string(),
            platform_name,
            path: target_path.to_string(),
            scope: "user".to_string(),
            enabled: true,
            official: false,
            project_local: false,
            binding_type: target_type.to_ascii_lowercase().replace(' ', "-"),
            content_hash: None,
            status: "ok".to_string(),
        },
    )
    .map_err(|e| e.to_string())
}

fn model_config_spec_for_target(
    platform_id: &str,
    target_path: &str,
) -> Result<adapters::ModelConfigSpec, String> {
    let kind = PlatformKind::from_str(platform_id)
        .ok_or_else(|| format!("Unknown platform id: {platform_id}"))?;
    let adapter = adapters::adapter_for_kind(&kind);
    let target_format = config_format_for_path(target_path)
        .ok_or_else(|| format!("Unsupported config format for path: {target_path}"))?;

    adapter
        .model_config_files()
        .into_iter()
        .find(|config| config.format == target_format)
        .ok_or_else(|| format!("目标格式未由 adapter 声明支持: {target_format}"))
}

fn backup_existing_target(
    conn: &Connection,
    target_path: &str,
    operation_id: &str,
    operation_type: &str,
) -> Result<Option<db::Backup>, String> {
    if !Path::new(target_path).exists() {
        return Ok(None);
    }

    let backup_path = fileops::create_backup(target_path)?;
    let hash = sha256_file(Path::new(&backup_path))?;
    let backup = db::Backup {
        id: format!(
            "backup-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ),
        operation_id: operation_id.to_string(),
        operation_type: operation_type.to_string(),
        original_path: target_path.to_string(),
        backup_path: backup_path.clone(),
        hash,
        created_at: Utc::now().to_rfc3339(),
    };
    db::insert_backup(conn, &backup).map_err(|e| e.to_string())?;
    Ok(Some(backup))
}

fn config_format_for_path(path: &str) -> Option<String> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();

    match extension.as_str() {
        "json" => Some("json".to_string()),
        "yaml" | "yml" => Some("yaml".to_string()),
        "toml" => Some("toml".to_string()),
        _ => None,
    }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

fn write_model_profile_to_target(
    target_path: &str,
    profile: &db::ModelProfile,
    config_spec: &adapters::ModelConfigSpec,
) -> Result<(), String> {
    let path = Path::new(target_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = render_model_profile_content(path, profile, config_spec)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn render_model_profile_content(
    path: &Path,
    profile: &db::ModelProfile,
    config_spec: &adapters::ModelConfigSpec,
) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let existing = fs::read_to_string(path).ok();

    match extension.as_str() {
        "json" => {
            let mut value = existing
                .as_deref()
                .and_then(|content| serde_json::from_str::<serde_json::Value>(content).ok())
                .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new()));
            let object = value
                .as_object_mut()
                .ok_or_else(|| format!("JSON config root must be an object: {}", path.display()))?;
            insert_json_model_keys(object, profile, config_spec.writable_keys);
            serde_json::to_string_pretty(&value).map_err(|e| e.to_string())
        }
        "yaml" | "yml" => {
            let mut value = existing
                .as_deref()
                .and_then(|content| serde_yaml::from_str::<serde_yaml::Value>(content).ok())
                .unwrap_or_else(|| serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
            let mapping = value
                .as_mapping_mut()
                .ok_or_else(|| format!("YAML config root must be a mapping: {}", path.display()))?;
            insert_yaml_model_keys(mapping, profile, config_spec.writable_keys);
            serde_yaml::to_string(&value).map_err(|e| e.to_string())
        }
        "toml" => {
            let mut value = existing
                .as_deref()
                .and_then(|content| toml::from_str::<toml::Value>(content).ok())
                .unwrap_or_else(|| toml::Value::Table(toml::map::Map::new()));
            let table = value
                .as_table_mut()
                .ok_or_else(|| format!("TOML config root must be a table: {}", path.display()))?;
            insert_toml_model_keys(table, profile, config_spec.writable_keys);
            toml::to_string_pretty(&value).map_err(|e| e.to_string())
        }
        _ => Err(format!(
            "Unsupported config format for path: {}",
            path.display()
        )),
    }
}

fn insert_json_model_keys(
    object: &mut serde_json::Map<String, serde_json::Value>,
    profile: &db::ModelProfile,
    writable_keys: &[&str],
) {
    for key in writable_keys {
        match *key {
            "provider" => {
                object.insert(
                    key.to_string(),
                    serde_json::Value::String(profile.provider.clone()),
                );
            }
            "model" => {
                object.insert(
                    key.to_string(),
                    serde_json::Value::String(profile.model_id.clone()),
                );
            }
            "base_url" => {
                object.insert(
                    key.to_string(),
                    serde_json::Value::String(profile.base_url.clone()),
                );
            }
            _ => {}
        }
    }
}

fn insert_yaml_model_keys(
    mapping: &mut serde_yaml::Mapping,
    profile: &db::ModelProfile,
    writable_keys: &[&str],
) {
    for key in writable_keys {
        let value = match *key {
            "provider" => Some(profile.provider.clone()),
            "model" => Some(profile.model_id.clone()),
            "base_url" => Some(profile.base_url.clone()),
            _ => None,
        };

        if let Some(value) = value {
            mapping.insert(
                serde_yaml::Value::String(key.to_string()),
                serde_yaml::Value::String(value),
            );
        }
    }
}

fn insert_toml_model_keys(
    table: &mut toml::map::Map<String, toml::Value>,
    profile: &db::ModelProfile,
    writable_keys: &[&str],
) {
    for key in writable_keys {
        let value = match *key {
            "provider" => Some(profile.provider.clone()),
            "model" => Some(profile.model_id.clone()),
            "base_url" => Some(profile.base_url.clone()),
            _ => None,
        };

        if let Some(value) = value {
            table.insert(key.to_string(), toml::Value::String(value));
        }
    }
}

fn upsert_model_binding_from_profile(
    conn: &Connection,
    platform_id: &str,
    target_path: &str,
    profile: &db::ModelProfile,
) -> Result<(), String> {
    let kind = PlatformKind::from_str(platform_id)
        .ok_or_else(|| format!("Unknown platform id: {platform_id}"))?;
    let key_presence = match profile.key_storage.as_str() {
        "config" => true,
        "env" => profile
            .env_key_names
            .iter()
            .any(|key| std::env::var(key).is_ok()),
        _ => false,
    };

    let warnings = if profile.key_storage == "config" {
        "API Key 存储在配置文件中".to_string()
    } else {
        String::new()
    };

    db::insert_model_binding(
        conn,
        &db::ModelBinding {
            id: format!("mb-{platform_id}"),
            platform_id: platform_id.to_string(),
            platform_name: kind.display_name().to_string(),
            detected_provider: profile.provider.clone(),
            detected_model_id: profile.model_id.clone(),
            detected_base_url: Some(profile.base_url.clone()),
            config_path: target_path.to_string(),
            key_presence,
            key_storage: profile.key_storage.clone(),
            key_suffix: if key_presence {
                Some("****".to_string())
            } else {
                None
            },
            validation_status: "not-checked".to_string(),
            last_validated_at: Some(Utc::now().to_rfc3339()),
            warnings,
        },
    )
    .map_err(|e| e.to_string())
}

// ── Batch Skill Sync Operations ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSyncItem {
    pub asset_id: String,
    pub asset_name: String,
    pub source_path: String,
    pub target_platform: String,
    pub target_path: String,
    pub action: String,
    pub existing_hash: Option<String>,
    pub source_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSyncPreview {
    pub strategy: String,
    pub total_items: usize,
    pub items: Vec<SkillSyncItemPreview>,
    pub has_conflicts: bool,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSyncItemPreview {
    pub asset_id: String,
    pub asset_name: String,
    pub target_platform: String,
    pub target_platform_name: String,
    pub target_path: String,
    pub source_path: String,
    pub action: String, // "install" | "skip" | "conflict"
    pub reason: String,
    pub supported: bool,
    pub existing_hash: Option<String>,
    pub source_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSyncRequest {
    pub strategy: String,
    pub source_platform_id: Option<String>,
    pub items: Vec<SkillSyncItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSyncResult {
    pub operation_id: String,
    pub strategy: String,
    pub total_items: usize,
    pub success_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub items: Vec<BatchSyncItemResult>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSyncItemResult {
    pub asset_id: String,
    pub asset_name: String,
    pub target_platform: String,
    pub target_path: String,
    pub status: String, // "success" | "skipped" | "failed"
    pub message: String,
    pub backup_id: Option<String>,
}

pub fn preview_skill_sync_plan(
    assets: &[db::Asset],
    platforms: &[db::Platform],
    strategy: &str,
    source_platform_id: Option<&str>,
) -> Result<BatchSyncPreview, String> {
    let mut items: Vec<SkillSyncItemPreview> = Vec::new();
    let mut has_conflicts = false;

    for asset in assets {
        if asset.asset_type != "Skill" {
            continue;
        }

        let source_installation = select_source_installation(asset, source_platform_id);
        let source_installation = match source_installation {
            Some(installation) => installation,
            None => continue,
        };
        let source_path = source_path_for_skill(&source_installation.path);
        let source_hash = source_installation
            .content_hash
            .clone()
            .or_else(|| asset.canonical_hash.clone())
            .or_else(|| asset.directory_hash.clone())
            .unwrap_or_default();

        for platform in platforms.iter().filter(|platform| platform.status == "active") {
            if platform.writable == "readonly" {
                items.push(SkillSyncItemPreview {
                    asset_id: asset.id.clone(),
                    asset_name: asset.name.clone(),
                    target_platform: platform.id.clone(),
                    target_platform_name: platform.name.clone(),
                    target_path: String::new(),
                    source_path: source_path.clone(),
                    action: "skip".to_string(),
                    reason: format!("{} 当前只读", platform.name),
                    supported: false,
                    existing_hash: None,
                    source_hash: source_hash.clone(),
                });
                continue;
            }

            let existing = asset.installations.iter().find(|inst| {
                normalize_platform_id(&inst.platform_id) == normalize_platform_id(&platform.id)
                    || normalize_platform_id(&inst.platform_name) == normalize_platform_id(&platform.id)
            });

            let target_path = if let Some(inst) = existing {
                inst.path.clone()
            } else {
                match target_skill_path(platform, &asset.name) {
                    Some(path) => path,
                    None => {
                        items.push(SkillSyncItemPreview {
                            asset_id: asset.id.clone(),
                            asset_name: asset.name.clone(),
                            target_platform: platform.id.clone(),
                            target_platform_name: platform.name.clone(),
                            target_path: String::new(),
                            source_path: source_path.clone(),
                            action: "skip".to_string(),
                            reason: format!("{} 缺少可写入的 Skills 目录", platform.name),
                            supported: false,
                            existing_hash: None,
                            source_hash: source_hash.clone(),
                        });
                        continue;
                    }
                }
            };

            let existing_hash = existing.and_then(|inst| inst.content_hash.clone());

            let action = if existing.is_some() {
                if normalize_platform_id(&source_installation.platform_id)
                    == normalize_platform_id(&platform.id)
                    || existing_hash.as_ref() == Some(&source_hash)
                    || source_hash.is_empty()
                {
                    "skip".to_string()
                } else {
                    has_conflicts = true;
                    "conflict".to_string()
                }
            } else {
                "install".to_string()
            };

            let reason = if action == "skip" && existing.is_some() {
                "已安装且内容一致".to_string()
            } else if action == "conflict" {
                "目标路径已存在，内容不一致".to_string()
            } else {
                "将安装到新平台".to_string()
            };

            items.push(SkillSyncItemPreview {
                asset_id: asset.id.clone(),
                asset_name: asset.name.clone(),
                target_platform: platform.id.clone(),
                target_platform_name: platform.name.clone(),
                target_path,
                source_path: source_path.clone(),
                action,
                reason,
                supported: existing.is_none(),
                existing_hash,
                source_hash: source_hash.clone(),
            });
        }
    }

    let install_count = items.iter().filter(|i| i.action == "install").count();
    let skip_count = items.iter().filter(|i| i.action == "skip").count();
    let conflict_count = items.iter().filter(|i| i.action == "conflict").count();

    let summary = format!(
        "共 {} 项：{} 安装、{} 跳过、{} 冲突",
        items.len(),
        install_count,
        skip_count,
        conflict_count
    );

    Ok(BatchSyncPreview {
        strategy: strategy.to_string(),
        total_items: items.len(),
        items,
        has_conflicts,
        summary,
    })
}

pub fn execute_skill_sync_plan(
    conn: &Connection,
    request: BatchSyncRequest,
) -> Result<BatchSyncResult, String> {
    let operation_id = format!(
        "batch-sync-{}-{}",
        request.strategy,
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    );

    let mut results = Vec::new();
    let mut success_count = 0;
    let mut skipped_count = 0;
    let mut failed_count = 0;

    for item in &request.items {
        if item.action != "install" {
            skipped_count += 1;
            results.push(BatchSyncItemResult {
                asset_id: item.asset_id.clone(),
                asset_name: item.asset_name.clone(),
                target_platform: item.target_platform.clone(),
                target_path: item.target_path.clone(),
                status: "skipped".to_string(),
                message: if item.action == "conflict" {
                    "目标平台已有不同内容，已跳过".to_string()
                } else {
                    "同步计划要求跳过".to_string()
                },
                backup_id: None,
            });
            continue;
        }

        let preview = PreviewOperationRequest {
            operation_type: "install-asset".to_string(),
            target_id: Some(item.asset_id.clone()),
            target_name: item.asset_name.clone(),
            target_type: "Skill".to_string(),
            target_path: item.target_path.clone(),
            source_path: Some(item.source_path.clone()),
            official: false,
            risk_level: Some("low".to_string()),
            platform_id: Some(item.target_platform.clone()),
        };

        let preview_result = preview_operation(preview.clone());
        match preview_result {
            Ok(p) if p.supported => {
                let exec_request = ExecuteOperationRequest { preview: preview.clone() };
                match execute_operation(conn, exec_request) {
                    Ok(result) => {
                        success_count += 1;
                        results.push(BatchSyncItemResult {
                            asset_id: item.asset_id.clone(),
                            asset_name: item.asset_name.clone(),
                            target_platform: item.target_platform.clone(),
                            target_path: item.target_path.clone(),
                            status: "success".to_string(),
                            message: result.message,
                            backup_id: result.backup_id,
                        });
                    }
                    Err(e) => {
                        failed_count += 1;
                        results.push(BatchSyncItemResult {
                            asset_id: item.asset_id.clone(),
                            asset_name: item.asset_name.clone(),
                            target_platform: item.target_platform.clone(),
                            target_path: item.target_path.clone(),
                            status: "failed".to_string(),
                            message: e,
                            backup_id: None,
                        });
                    }
                }
            }
            Ok(p) => {
                skipped_count += 1;
                results.push(BatchSyncItemResult {
                    asset_id: item.asset_id.clone(),
                    asset_name: item.asset_name.clone(),
                    target_platform: item.target_platform.clone(),
                    target_path: item.target_path.clone(),
                    status: "skipped".to_string(),
                    message: p.risks.first().cloned().unwrap_or_else(|| "操作不支持".to_string()),
                    backup_id: None,
                });
            }
            Err(e) => {
                failed_count += 1;
                results.push(BatchSyncItemResult {
                    asset_id: item.asset_id.clone(),
                    asset_name: item.asset_name.clone(),
                    target_platform: item.target_platform.clone(),
                    target_path: item.target_path.clone(),
                    status: "failed".to_string(),
                    message: e,
                    backup_id: None,
                });
            }
        }
    }

    let log = db::OperationLog {
        id: operation_id.clone(),
        operation_type: format!("batch-sync-{}", request.strategy),
        status: if failed_count == 0 { "completed".to_string() } else { "partial".to_string() },
        target_type: "Skill".to_string(),
        target_id: None,
        target_path: None,
        preview_json: Some(serde_json::to_string(&request).unwrap_or_default()),
        result_json: Some(serde_json::to_string(&results).unwrap_or_default()),
        backup_id: None,
        created_at: Utc::now().to_rfc3339(),
        completed_at: Some(Utc::now().to_rfc3339()),
    };
    let _ = db::insert_operation(conn, &log);

    let message = format!(
        "批量同步完成：{} 成功、{} 跳过、{} 失败",
        success_count, skipped_count, failed_count
    );

    Ok(BatchSyncResult {
        operation_id,
        strategy: request.strategy,
        total_items: results.len(),
        success_count,
        skipped_count,
        failed_count,
        items: results,
        message,
    })
}

fn normalize_platform_id(value: &str) -> String {
    value.to_lowercase().replace(" ", "").replace("-", "").replace("_", "")
}

fn sanitize_asset_name(name: &str) -> String {
    name.trim()
        .replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-' && c != '.', "-")
        .trim_matches('-')
        .to_string()
}

fn select_source_installation<'a>(
    asset: &'a db::Asset,
    source_platform_id: Option<&str>,
) -> Option<&'a db::Installation> {
    if let Some(source_platform_id) = source_platform_id {
        let normalized_source = normalize_platform_id(source_platform_id);
        return asset.installations.iter().find(|installation| {
            normalize_platform_id(&installation.platform_id) == normalized_source
                || normalize_platform_id(&installation.platform_name) == normalized_source
        });
    }

    asset.installations.first()
}

fn source_path_for_skill(path: &str) -> String {
    if path.ends_with("/SKILL.md") {
        return path.trim_end_matches("/SKILL.md").to_string();
    }
    path.to_string()
}

fn target_skill_path(platform: &db::Platform, asset_name: &str) -> Option<String> {
    let root = platform.config_roots.first()?;
    let kind = PlatformKind::from_str(&platform.kind)
        .or_else(|| PlatformKind::from_str(&platform.id))?;
    let adapter = adapters::adapter_for_kind(&kind);
    let skill_subdir = adapter
        .asset_search_specs()
        .into_iter()
        .find(|spec| spec.asset_type == "Skill")
        .map(|spec| spec.subdir)
        .unwrap_or("skills");
    let base = sanitize_asset_name(asset_name);
    if base.is_empty() {
        return None;
    }

    Some(format!(
        "{}/{}/{}",
        root.trim_end_matches('/'),
        skill_subdir.trim_matches('/'),
        base
    ))
}
