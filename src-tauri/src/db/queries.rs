use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};

use super::models::*;
use super::schema::run_migrations;

pub fn insert_platform(conn: &Connection, platform: &Platform) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO platforms (id, name, kind, cli_path, version, config_roots, writable, detected_at, status, asset_count, warning_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            platform.id,
            platform.name,
            platform.kind,
            platform.cli_path,
            platform.version,
            serde_json::to_string(&platform.config_roots).unwrap_or_else(|_| "[]".to_string()),
            platform.writable,
            platform.detected_at,
            platform.status,
            platform.asset_count,
            platform.warning_count,
        ],
    )?;
    Ok(())
}

pub fn get_all_platforms(conn: &Connection) -> SqlResult<Vec<Platform>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, cli_path, version, config_roots, writable, detected_at, status, asset_count, warning_count FROM platforms"
    )?;
    let rows = stmt.query_map([], |row| {
        let roots_str: String = row.get(5)?;
        let config_roots = serde_json::from_str::<Vec<String>>(&roots_str)
            .unwrap_or_else(|_| {
                roots_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
            });
        Ok(Platform {
            id: row.get(0)?,
            name: row.get(1)?,
            kind: row.get(2)?,
            cli_path: row.get(3)?,
            version: row.get(4)?,
            config_roots,
            writable: row.get(6)?,
            detected_at: row.get(7)?,
            status: row.get(8)?,
            asset_count: row.get(9)?,
            warning_count: row.get(10)?,
        })
    })?;
    rows.collect()
}

pub fn insert_asset(conn: &Connection, asset: &Asset) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO assets (id, asset_type, name, description, author, version, source, canonical_hash, directory_hash, risk_level, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            asset.id, asset.asset_type, asset.name, asset.description,
            asset.author, asset.version, asset.source,
            asset.canonical_hash, asset.directory_hash, asset.risk_level,
            asset.status, asset.created_at, asset.updated_at,
        ],
    )?;
    for inst in &asset.installations {
        insert_installation(conn, inst)?;
    }
    Ok(())
}

pub fn insert_installation(conn: &Connection, inst: &Installation) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, content_hash, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            inst.id, inst.asset_id, inst.platform_id, inst.path, inst.scope,
            inst.enabled as i32, inst.official as i32, inst.project_local as i32,
            inst.binding_type, inst.content_hash, inst.status,
        ],
    )?;
    Ok(())
}

pub fn get_all_assets(conn: &Connection) -> SqlResult<Vec<Asset>> {
    let mut stmt = conn.prepare(
        "SELECT
            a.id, a.asset_type, a.name, a.description, a.author, a.version,
            a.source, a.canonical_hash, a.directory_hash, a.risk_level,
            a.status, a.created_at, a.updated_at,
            i.id as inst_id, i.asset_id, i.platform_id, i.path, i.scope,
            i.enabled, i.official, i.project_local, i.binding_type,
            i.content_hash, i.status as inst_status,
            COALESCE(p.name, i.platform_id) as platform_name
         FROM assets a
         LEFT JOIN installations i ON i.asset_id = a.id
         LEFT JOIN platforms p ON p.id = i.platform_id
         ORDER BY a.id, i.id",
    )?;

    let mut asset_map: linked_hash_map::LinkedHashMap<String, Asset> =
        linked_hash_map::LinkedHashMap::new();

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let asset_id: String = row.get(0)?;
        let inst_id: Option<String> = row.get(13)?;

        let asset = asset_map.entry(asset_id.clone()).or_insert_with(|| Asset {
            id: asset_id,
            asset_type: row.get(1).unwrap_or_default(),
            name: row.get(2).unwrap_or_default(),
            description: row.get(3).unwrap_or_default(),
            author: row.get(4).unwrap_or_default(),
            version: row.get(5).unwrap_or_default(),
            source: row.get(6).unwrap_or_default(),
            canonical_hash: row.get(7).unwrap_or_default(),
            directory_hash: row.get(8).unwrap_or_default(),
            risk_level: row.get(9).unwrap_or_default(),
            status: row.get(10).unwrap_or_default(),
            created_at: row.get(11).unwrap_or_default(),
            updated_at: row.get(12).unwrap_or_default(),
            installations: Vec::new(),
        });

        if let Some(id) = inst_id {
            asset.installations.push(Installation {
                id,
                asset_id: row.get(14).unwrap_or_default(),
                platform_id: row.get(15).unwrap_or_default(),
                path: row.get(16).unwrap_or_default(),
                scope: row.get(17).unwrap_or_default(),
                enabled: row.get::<_, i32>(18).unwrap_or(0) != 0,
                official: row.get::<_, i32>(19).unwrap_or(0) != 0,
                project_local: row.get::<_, i32>(20).unwrap_or(0) != 0,
                binding_type: row.get(21).unwrap_or_default(),
                content_hash: row.get(22).unwrap_or_default(),
                status: row.get(23).unwrap_or_default(),
                platform_name: row.get(24).unwrap_or_default(),
            });
        }
    }

    Ok(asset_map.into_iter().map(|(_, v)| v).collect())
}

pub fn get_asset_by_id(conn: &Connection, asset_id: &str) -> SqlResult<Option<Asset>> {
    let mut stmt = conn.prepare(
        "SELECT
            a.id, a.asset_type, a.name, a.description, a.author, a.version,
            a.source, a.canonical_hash, a.directory_hash, a.risk_level,
            a.status, a.created_at, a.updated_at,
            i.id as inst_id, i.asset_id, i.platform_id, i.path, i.scope,
            i.enabled, i.official, i.project_local, i.binding_type,
            i.content_hash, i.status as inst_status,
            COALESCE(p.name, i.platform_id) as platform_name
         FROM assets a
         LEFT JOIN installations i ON i.asset_id = a.id
         LEFT JOIN platforms p ON p.id = i.platform_id
         WHERE a.id = ?1
         ORDER BY i.id",
    )?;

    let mut rows = stmt.query([asset_id])?;
    let mut asset: Option<Asset> = None;

    while let Some(row) = rows.next()? {
        let inst_id: Option<String> = row.get(13)?;

        let current_asset = asset.get_or_insert_with(|| Asset {
            id: row.get(0).unwrap_or_default(),
            asset_type: row.get(1).unwrap_or_default(),
            name: row.get(2).unwrap_or_default(),
            description: row.get(3).unwrap_or_default(),
            author: row.get(4).unwrap_or_default(),
            version: row.get(5).unwrap_or_default(),
            source: row.get(6).unwrap_or_default(),
            canonical_hash: row.get(7).unwrap_or_default(),
            directory_hash: row.get(8).unwrap_or_default(),
            risk_level: row.get(9).unwrap_or_default(),
            status: row.get(10).unwrap_or_default(),
            created_at: row.get(11).unwrap_or_default(),
            updated_at: row.get(12).unwrap_or_default(),
            installations: Vec::new(),
        });

        if let Some(id) = inst_id {
            current_asset.installations.push(Installation {
                id,
                asset_id: row.get(14).unwrap_or_default(),
                platform_id: row.get(15).unwrap_or_default(),
                path: row.get(16).unwrap_or_default(),
                scope: row.get(17).unwrap_or_default(),
                enabled: row.get::<_, i32>(18).unwrap_or(0) != 0,
                official: row.get::<_, i32>(19).unwrap_or(0) != 0,
                project_local: row.get::<_, i32>(20).unwrap_or(0) != 0,
                binding_type: row.get(21).unwrap_or_default(),
                content_hash: row.get(22).unwrap_or_default(),
                status: row.get(23).unwrap_or_default(),
                platform_name: row.get(24).unwrap_or_default(),
            });
        }
    }

    Ok(asset)
}

#[allow(dead_code)]
pub fn get_asset_installations(conn: &Connection, asset_id: &str) -> SqlResult<Vec<Installation>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.asset_id, i.platform_id, i.path, i.scope, i.enabled, i.official, i.project_local, i.binding_type, i.content_hash, i.status, p.name as platform_name
         FROM installations i
         LEFT JOIN platforms p ON i.platform_id = p.id
         WHERE i.asset_id = ?1"
    )?;
    let rows = stmt.query_map([asset_id], |row| {
        Ok(Installation {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            platform_id: row.get(2)?,
            path: row.get(3)?,
            scope: row.get(4)?,
            enabled: row.get::<_, i32>(5)? != 0,
            official: row.get::<_, i32>(6)? != 0,
            project_local: row.get::<_, i32>(7)? != 0,
            binding_type: row.get(8)?,
            content_hash: row.get(9)?,
            status: row.get(10)?,
            platform_name: row.get(11).unwrap_or_default(),
        })
    })?;
    rows.collect()
}

pub fn insert_model_binding(conn: &Connection, binding: &ModelBinding) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO model_bindings (id, platform_id, detected_provider, detected_model_id, detected_base_url, config_path, key_presence, key_storage, key_suffix, validation_status, last_validated_at, warnings)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            binding.id, binding.platform_id, binding.detected_provider, binding.detected_model_id,
            binding.detected_base_url, binding.config_path, binding.key_presence as i32,
            binding.key_storage, binding.key_suffix, binding.validation_status,
            binding.last_validated_at, binding.warnings,
        ],
    )?;
    Ok(())
}

pub fn get_all_model_bindings(conn: &Connection) -> SqlResult<Vec<ModelBinding>> {
    let mut stmt = conn.prepare(
        "SELECT m.id, m.platform_id, COALESCE(p.name, m.platform_id), m.detected_provider, m.detected_model_id, m.detected_base_url, m.config_path, m.key_presence, m.key_storage, m.key_suffix, m.validation_status, m.last_validated_at, m.warnings
         FROM model_bindings m
         LEFT JOIN platforms p ON m.platform_id = p.id"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ModelBinding {
            id: row.get(0)?,
            platform_id: row.get(1)?,
            platform_name: row.get(2)?,
            detected_provider: row.get(3)?,
            detected_model_id: row.get(4)?,
            detected_base_url: row.get(5)?,
            config_path: row.get(6)?,
            key_presence: row.get::<_, i32>(7)? != 0,
            key_storage: row.get(8)?,
            key_suffix: row.get(9)?,
            validation_status: row.get(10)?,
            last_validated_at: row.get(11)?,
            warnings: row.get(12)?,
        })
    })?;
    rows.collect()
}

pub fn insert_model_profile(conn: &Connection, profile: &ModelProfile) -> SqlResult<()> {
    run_migrations(conn)?;
    conn.execute(
        "INSERT OR REPLACE INTO model_profiles (
            id, name, provider, model_id, base_url, key_storage,
            env_key_names, notes, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            profile.id,
            profile.name,
            profile.provider,
            profile.model_id,
            profile.base_url,
            profile.key_storage,
            serde_json::to_string(&profile.env_key_names).unwrap_or_else(|_| "[]".to_string()),
            profile.notes,
            profile.created_at,
            profile.updated_at,
        ],
    )?;
    Ok(())
}

fn seed_default_model_profiles(conn: &Connection) -> SqlResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM model_profiles", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    for profile in default_model_profiles() {
        insert_model_profile(conn, &profile)?;
    }

    Ok(())
}

fn default_model_profiles() -> Vec<ModelProfile> {
    let now = chrono::Utc::now().to_rfc3339();
    vec![
        ModelProfile {
            id: "mp-1".to_string(),
            name: "OpenAI Default".to_string(),
            provider: "OpenAI".to_string(),
            model_id: "gpt-4o".to_string(),
            base_url: "https://api.openai.com".to_string(),
            key_storage: "env".to_string(),
            env_key_names: vec!["OPENAI_API_KEY".to_string()],
            notes: "OpenAI 官方默认配置".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        ModelProfile {
            id: "mp-2".to_string(),
            name: "Claude Default".to_string(),
            provider: "Anthropic".to_string(),
            model_id: "claude-3-5-sonnet".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            key_storage: "keychain".to_string(),
            env_key_names: vec!["ANTHROPIC_API_KEY".to_string()],
            notes: "Anthropic 官方默认配置".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        ModelProfile {
            id: "mp-3".to_string(),
            name: "Kimi Coding".to_string(),
            provider: "Kimi".to_string(),
            model_id: "kimi-for-coding".to_string(),
            base_url: "https://api.moonshot.cn".to_string(),
            key_storage: "env".to_string(),
            env_key_names: vec!["MOONSHOT_API_KEY".to_string()],
            notes: "Kimi 编程专用配置".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        ModelProfile {
            id: "mp-4".to_string(),
            name: "OpenRouter Backup".to_string(),
            provider: "OpenRouter".to_string(),
            model_id: "anthropic/claude-3.5-sonnet".to_string(),
            base_url: "https://openrouter.ai/api".to_string(),
            key_storage: "env".to_string(),
            env_key_names: vec!["OPENROUTER_API_KEY".to_string()],
            notes: "OpenRouter 备用配置".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        ModelProfile {
            id: "mp-5".to_string(),
            name: "Local Ollama".to_string(),
            provider: "Ollama".to_string(),
            model_id: "llama3.1".to_string(),
            base_url: "http://localhost:11434".to_string(),
            key_storage: "unknown".to_string(),
            env_key_names: Vec::new(),
            notes: "本地 Ollama 部署".to_string(),
            created_at: now.clone(),
            updated_at: now,
        },
    ]
}

pub fn get_model_profiles(conn: &Connection) -> SqlResult<Vec<ModelProfile>> {
    run_migrations(conn)?;
    seed_default_model_profiles(conn)?;

    let mut stmt = conn.prepare(
        "SELECT id, name, provider, model_id, base_url, key_storage, env_key_names, notes, created_at, updated_at
         FROM model_profiles
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let env_key_names_raw: String = row.get(6)?;
        Ok(ModelProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            provider: row.get(2)?,
            model_id: row.get(3)?,
            base_url: row.get(4)?,
            key_storage: row.get(5)?,
            env_key_names: serde_json::from_str(&env_key_names_raw).unwrap_or_default(),
            notes: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

pub fn get_model_profile_by_id(
    conn: &Connection,
    profile_id: &str,
) -> SqlResult<Option<ModelProfile>> {
    run_migrations(conn)?;
    seed_default_model_profiles(conn)?;

    conn.query_row(
        "SELECT id, name, provider, model_id, base_url, key_storage, env_key_names, notes, created_at, updated_at
         FROM model_profiles
         WHERE id = ?1",
        [profile_id],
        |row| {
            let env_key_names_raw: String = row.get(6)?;
            Ok(ModelProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                provider: row.get(2)?,
                model_id: row.get(3)?,
                base_url: row.get(4)?,
                key_storage: row.get(5)?,
                env_key_names: serde_json::from_str(&env_key_names_raw).unwrap_or_default(),
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .optional()
}

pub fn insert_backup(conn: &Connection, backup: &Backup) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO backups (id, operation_id, operation_type, original_path, backup_path, hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            backup.id, backup.operation_id, backup.operation_type,
            backup.original_path, backup.backup_path, backup.hash, backup.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_all_backups(conn: &Connection) -> SqlResult<Vec<Backup>> {
    let mut stmt = conn.prepare("SELECT id, operation_id, operation_type, original_path, backup_path, hash, created_at FROM backups ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Backup {
            id: row.get(0)?,
            operation_id: row.get(1)?,
            operation_type: row.get(2)?,
            original_path: row.get(3)?,
            backup_path: row.get(4)?,
            hash: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn get_all_operation_logs(conn: &Connection) -> SqlResult<Vec<OperationLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, operation_type, status, target_type, target_id, target_path,
                preview_json, result_json, backup_id, created_at, completed_at
         FROM operations
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(OperationLog {
            id: row.get(0)?,
            operation_type: row.get(1)?,
            status: row.get(2)?,
            target_type: row.get(3)?,
            target_id: row.get(4)?,
            target_path: row.get(5)?,
            preview_json: row.get(6).unwrap_or_default(),
            result_json: row.get(7).unwrap_or_default(),
            backup_id: row.get(8)?,
            created_at: row.get(9)?,
            completed_at: row.get(10)?,
        })
    })?;
    rows.collect()
}

pub fn insert_operation(conn: &Connection, operation: &OperationLog) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO operations (
            id, operation_type, status, target_type, target_id, target_path,
            preview_json, result_json, backup_id, created_at, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            operation.id,
            operation.operation_type,
            operation.status,
            operation.target_type,
            operation.target_id,
            operation.target_path,
            operation.preview_json,
            operation.result_json,
            operation.backup_id,
            operation.created_at,
            operation.completed_at,
        ],
    )?;
    Ok(())
}

pub fn insert_finding(conn: &Connection, finding: &Finding) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO findings (id, asset_id, asset_name, platform_id, platform_name, issue, risk_level, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            finding.id, finding.asset_id, finding.asset_name, finding.platform_id,
            finding.platform_name, finding.issue, finding.risk_level, finding.detail,
        ],
    )?;
    Ok(())
}

pub fn get_all_findings(conn: &Connection) -> SqlResult<Vec<Finding>> {
    let mut stmt = conn.prepare("SELECT id, asset_id, asset_name, platform_id, platform_name, issue, risk_level, detail FROM findings")?;
    let rows = stmt.query_map([], |row| {
        Ok(Finding {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            asset_name: row.get(2)?,
            platform_id: row.get(3)?,
            platform_name: row.get(4)?,
            issue: row.get(5)?,
            risk_level: row.get(6)?,
            detail: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn insert_scan_run(conn: &Connection, run: &ScanRun) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO scan_runs (id, started_at, completed_at, status, platforms_found, assets_found, duplicates_found, warnings_found)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            run.id, run.started_at, run.completed_at, run.status,
            run.platforms_found, run.assets_found, run.duplicates_found, run.warnings_found,
        ],
    )?;
    Ok(())
}

pub fn insert_scan_step(conn: &Connection, step: &ScanStep) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO scan_steps (id, scan_run_id, step_key, title, description, status, detail, order_index, started_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            step.id,
            step.scan_run_id,
            step.step_key,
            step.title,
            step.description,
            step.status,
            step.detail,
            step.order_index,
            step.started_at,
            step.completed_at,
        ],
    )?;
    Ok(())
}

pub fn get_scan_steps_for_run(conn: &Connection, scan_run_id: &str) -> SqlResult<Vec<ScanStep>> {
    let mut stmt = conn.prepare(
        "SELECT id, scan_run_id, step_key, title, description, status, detail, order_index, started_at, completed_at
         FROM scan_steps
         WHERE scan_run_id = ?1
         ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map([scan_run_id], |row| {
        Ok(ScanStep {
            id: row.get(0)?,
            scan_run_id: row.get(1)?,
            step_key: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            status: row.get(5)?,
            detail: row.get(6)?,
            order_index: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

pub fn get_all_scan_runs(conn: &Connection) -> SqlResult<Vec<ScanRun>> {
    let mut stmt = conn.prepare(
        "SELECT
            r.id, r.started_at, r.completed_at, r.status,
            r.platforms_found, r.assets_found, r.duplicates_found, r.warnings_found,
            s.id, s.scan_run_id, s.step_key, s.title, s.description,
            s.status, s.detail, s.order_index, s.started_at, s.completed_at
         FROM scan_runs r
         LEFT JOIN scan_steps s ON s.scan_run_id = r.id
         ORDER BY r.started_at DESC, s.order_index ASC",
    )?;

    let mut run_map: linked_hash_map::LinkedHashMap<String, ScanRun> =
        linked_hash_map::LinkedHashMap::new();

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let run_id: String = row.get(0)?;

        let run = run_map.entry(run_id.clone()).or_insert_with(|| ScanRun {
            id: run_id,
            started_at: row.get(1).unwrap_or_default(),
            completed_at: row.get(2).unwrap_or_default(),
            status: row.get(3).unwrap_or_default(),
            platforms_found: row.get(4).unwrap_or(0),
            assets_found: row.get(5).unwrap_or(0),
            duplicates_found: row.get(6).unwrap_or(0),
            warnings_found: row.get(7).unwrap_or(0),
            steps: Vec::new(),
        });

        if let Some(step_id) = row.get::<_, Option<String>>(8)? {
            run.steps.push(ScanStep {
                id: step_id,
                scan_run_id: row.get(9).unwrap_or_default(),
                step_key: row.get(10).unwrap_or_default(),
                title: row.get(11).unwrap_or_default(),
                description: row.get(12).unwrap_or_default(),
                status: row.get(13).unwrap_or_default(),
                detail: row.get(14).unwrap_or_default(),
                order_index: row.get(15).unwrap_or(0),
                started_at: row.get(16).unwrap_or_default(),
                completed_at: row.get(17).unwrap_or_default(),
            });
        }
    }

    Ok(run_map.into_iter().map(|(_, v)| v).collect())
}

pub fn clear_scan_data(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM installations", [])?;
    conn.execute("DELETE FROM assets", [])?;
    conn.execute("DELETE FROM findings", [])?;
    conn.execute("DELETE FROM model_bindings", [])?;
    conn.execute("DELETE FROM platforms", [])?;
    Ok(())
}

fn default_settings(
    default_scan_paths: &[String],
    db_location: &str,
    trash_location: &str,
) -> AppSettings {
    AppSettings {
        scan_paths: default_scan_paths.to_vec(),
        include_project_local: true,
        enable_deep_scan: false,
        db_location: db_location.to_string(),
        trash_location: trash_location.to_string(),
        theme: "system".to_string(),
        security_level: "strict".to_string(),
        ignored_platform_ids: Vec::new(),
    }
}

fn get_setting_value(conn: &Connection, key: &str) -> SqlResult<Option<String>> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        [key],
        |row| row.get(0),
    )
    .optional()
}

pub fn get_settings(
    conn: &Connection,
    default_scan_paths: &[String],
    db_location: &str,
    trash_location: &str,
) -> SqlResult<AppSettings> {
    run_migrations(conn)?;

    let mut settings = default_settings(default_scan_paths, db_location, trash_location);

    if let Some(raw) = get_setting_value(conn, "scan_paths")? {
        settings.scan_paths =
            serde_json::from_str(&raw).unwrap_or_else(|_| settings.scan_paths.clone());
    }
    if let Some(raw) = get_setting_value(conn, "include_project_local")? {
        settings.include_project_local = raw == "true";
    }
    if let Some(raw) = get_setting_value(conn, "enable_deep_scan")? {
        settings.enable_deep_scan = raw == "true";
    }
    if let Some(raw) = get_setting_value(conn, "db_location")? {
        settings.db_location = raw;
    }
    if let Some(raw) = get_setting_value(conn, "trash_location")? {
        settings.trash_location = raw;
    }
    if let Some(raw) = get_setting_value(conn, "theme")? {
        settings.theme = raw;
    }
    if let Some(raw) = get_setting_value(conn, "security_level")? {
        settings.security_level = raw;
    }
    if let Some(raw) = get_setting_value(conn, "ignored_platform_ids")? {
        settings.ignored_platform_ids =
            serde_json::from_str(&raw).unwrap_or_else(|_| settings.ignored_platform_ids.clone());
    }

    Ok(settings)
}

pub fn save_settings(conn: &Connection, settings: &AppSettings) -> SqlResult<()> {
    run_migrations(conn)?;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('scan_paths', ?1)",
        params![serde_json::to_string(&settings.scan_paths).unwrap_or_else(|_| "[]".to_string())],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('include_project_local', ?1)",
        params![settings.include_project_local.to_string()],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('enable_deep_scan', ?1)",
        params![settings.enable_deep_scan.to_string()],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('db_location', ?1)",
        params![settings.db_location],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('trash_location', ?1)",
        params![settings.trash_location],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('theme', ?1)",
        params![settings.theme],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('security_level', ?1)",
        params![settings.security_level],
    )?;
    tx.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ignored_platform_ids', ?1)",
        params![serde_json::to_string(&settings.ignored_platform_ids)
            .unwrap_or_else(|_| "[]".to_string())],
    )?;
    tx.commit()
}
