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

    match request.operation_type.as_str() {
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
        needs_restart: false,
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

    if adapter.writable_status() == "readonly" || adapter.model_config_files().is_empty() {
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
        written_keys: vec![
            "provider".to_string(),
            "model".to_string(),
            "base_url".to_string(),
        ],
        needs_restart: true,
        risks: vec!["将修改平台模型配置".to_string()],
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
            fileops::restore_from_backup(&backup_path, &preview.target_path)?;
            OperationExecutionResult {
                operation_id: operation_id.clone(),
                operation_type: preview.operation_type.clone(),
                target_id: preview.target_id.clone(),
                target_path: preview.target_path.clone(),
                outcome_path: Some(preview.target_path.clone()),
                backup_id: None,
                message: "已恢复备份".to_string(),
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
            let backup = backup_existing_target(conn, &preview.target_path, &operation_id)?;
            write_model_profile_to_target(&preview.target_path, &profile)?;
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
        preview_json: serde_json::to_string(&preview).map_err(|e| e.to_string())?,
        result_json: serde_json::to_string(&execution_result).map_err(|e| e.to_string())?,
        backup_id: execution_result.backup_id.clone(),
        created_at: Utc::now().to_rfc3339(),
        completed_at: Some(Utc::now().to_rfc3339()),
    };
    db::insert_operation(conn, &log).map_err(|e| e.to_string())?;

    Ok(execution_result)
}

fn backup_existing_target(
    conn: &Connection,
    target_path: &str,
    operation_id: &str,
) -> Result<Option<db::Backup>, String> {
    if !Path::new(target_path).exists() {
        return Ok(None);
    }

    let backup_path = fileops::create_backup(target_path)?;
    let hash = sha256_file(Path::new(&backup_path))?;
    let backup = db::Backup {
        id: format!("backup-{}", Utc::now().timestamp_nanos_opt().unwrap_or_default()),
        operation_id: operation_id.to_string(),
        operation_type: "apply-model-profile".to_string(),
        original_path: target_path.to_string(),
        backup_path: backup_path.clone(),
        hash,
        created_at: Utc::now().to_rfc3339(),
    };
    db::insert_backup(conn, &backup).map_err(|e| e.to_string())?;
    Ok(Some(backup))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

fn write_model_profile_to_target(target_path: &str, profile: &db::ModelProfile) -> Result<(), String> {
    let path = Path::new(target_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = render_model_profile_content(path, profile)?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn render_model_profile_content(path: &Path, profile: &db::ModelProfile) -> Result<String, String> {
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
            object.insert("provider".to_string(), serde_json::Value::String(profile.provider.clone()));
            object.insert("model".to_string(), serde_json::Value::String(profile.model_id.clone()));
            object.insert("base_url".to_string(), serde_json::Value::String(profile.base_url.clone()));
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
            mapping.insert(
                serde_yaml::Value::String("provider".to_string()),
                serde_yaml::Value::String(profile.provider.clone()),
            );
            mapping.insert(
                serde_yaml::Value::String("model".to_string()),
                serde_yaml::Value::String(profile.model_id.clone()),
            );
            mapping.insert(
                serde_yaml::Value::String("base_url".to_string()),
                serde_yaml::Value::String(profile.base_url.clone()),
            );
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
            table.insert("provider".to_string(), toml::Value::String(profile.provider.clone()));
            table.insert("model".to_string(), toml::Value::String(profile.model_id.clone()));
            table.insert("base_url".to_string(), toml::Value::String(profile.base_url.clone()));
            toml::to_string_pretty(&value).map_err(|e| e.to_string())
        }
        _ => Err(format!("Unsupported config format for path: {}", path.display())),
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
