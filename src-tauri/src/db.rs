use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const SETTINGS_MIGRATION_VERSION: &str = "2026-06-13-settings-persistence";

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
    pub preview_json: String,
    pub result_json: String,
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

pub fn init_db(db_path: &Path) -> SqlResult<()> {
    let conn = Connection::open(db_path)?;
    create_tables(&conn)?;
    run_migrations(&conn)?;
    Ok(())
}

fn create_tables(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS platforms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            cli_path TEXT,
            version TEXT,
            config_roots TEXT,
            writable TEXT,
            detected_at TEXT,
            status TEXT,
            asset_count INTEGER DEFAULT 0,
            warning_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            asset_type TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            author TEXT,
            version TEXT,
            source TEXT,
            canonical_hash TEXT,
            directory_hash TEXT,
            risk_level TEXT,
            status TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS installations (
            id TEXT PRIMARY KEY,
            asset_id TEXT NOT NULL,
            platform_id TEXT NOT NULL,
            path TEXT NOT NULL,
            scope TEXT,
            enabled INTEGER,
            official INTEGER,
            project_local INTEGER,
            binding_type TEXT,
            content_hash TEXT,
            status TEXT,
            FOREIGN KEY (asset_id) REFERENCES assets(id),
            FOREIGN KEY (platform_id) REFERENCES platforms(id)
        );

        CREATE TABLE IF NOT EXISTS model_bindings (
            id TEXT PRIMARY KEY,
            platform_id TEXT NOT NULL,
            detected_provider TEXT,
            detected_model_id TEXT,
            detected_base_url TEXT,
            config_path TEXT,
            key_presence INTEGER,
            key_storage TEXT,
            key_suffix TEXT,
            validation_status TEXT,
            last_validated_at TEXT,
            warnings TEXT
        );

        CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            operation_id TEXT,
            operation_type TEXT,
            original_path TEXT,
            backup_path TEXT,
            hash TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS findings (
            id TEXT PRIMARY KEY,
            asset_id TEXT,
            asset_name TEXT,
            platform_id TEXT,
            platform_name TEXT,
            issue TEXT,
            risk_level TEXT,
            detail TEXT
        );

        CREATE TABLE IF NOT EXISTS scan_runs (
            id TEXT PRIMARY KEY,
            started_at TEXT,
            completed_at TEXT,
            status TEXT,
            platforms_found INTEGER,
            assets_found INTEGER,
            duplicates_found INTEGER,
            warnings_found INTEGER
        );

        "#,
    )?;
    Ok(())
}

pub fn run_migrations(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
        [],
    )?;

    let applied = conn
        .query_row(
            "SELECT version FROM schema_migrations WHERE version = ?1",
            [SETTINGS_MIGRATION_VERSION],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if applied.is_some() {
        return Ok(());
    }

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS operations (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            status TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            target_path TEXT,
            preview_json TEXT,
            result_json TEXT,
            backup_id TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS model_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            model_id TEXT NOT NULL,
            base_url TEXT NOT NULL,
            key_storage TEXT NOT NULL,
            env_key_names TEXT NOT NULL,
            notes TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scan_steps (
            id TEXT PRIMARY KEY,
            scan_run_id TEXT NOT NULL,
            step_key TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT,
            order_index INTEGER NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            FOREIGN KEY (scan_run_id) REFERENCES scan_runs(id)
        );
        "#,
    )?;

    conn.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        params![SETTINGS_MIGRATION_VERSION, chrono::Utc::now().to_rfc3339()],
    )?;

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
    }
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
    tx.commit()
}

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
            platform.config_roots.join(","),
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
        Ok(Platform {
            id: row.get(0)?,
            name: row.get(1)?,
            kind: row.get(2)?,
            cli_path: row.get(3)?,
            version: row.get(4)?,
            config_roots: roots_str.split(',').map(|s| s.to_string()).collect(),
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
         ORDER BY a.id, i.id"
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

#[allow(dead_code)]
fn get_asset_installations(conn: &Connection, asset_id: &str) -> SqlResult<Vec<Installation>> {
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
    let mut stmt = conn.prepare("SELECT id, started_at, completed_at, status, platforms_found, assets_found, duplicates_found, warnings_found FROM scan_runs ORDER BY started_at DESC")?;
    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        Ok(ScanRun {
            steps: get_scan_steps_for_run(conn, &id)?,
            id,
            started_at: row.get(1)?,
            completed_at: row.get(2)?,
            status: row.get(3)?,
            platforms_found: row.get(4)?,
            assets_found: row.get(5)?,
            duplicates_found: row.get(6)?,
            warnings_found: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn clear_scan_data(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM installations", [])?;
    conn.execute("DELETE FROM assets", [])?;
    conn.execute("DELETE FROM findings", [])?;
    conn.execute("DELETE FROM model_bindings", [])?;
    conn.execute("DELETE FROM platforms", [])?;
    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_paths() -> (Vec<String>, String, String) {
        (
            vec![
                "/Users/test/.codex".to_string(),
                "/Users/test/.claude".to_string(),
            ],
            "/tmp/agent-assets-manager/data.db".to_string(),
            "/tmp/agent-assets-manager/Trash".to_string(),
        )
    }

    #[test]
    fn get_settings_returns_defaults_when_database_is_empty() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        let (scan_paths, db_location, trash_location) = test_paths();
        let settings = get_settings(&conn, &scan_paths, &db_location, &trash_location).unwrap();

        assert_eq!(settings.scan_paths, scan_paths);
        assert!(settings.include_project_local);
        assert!(!settings.enable_deep_scan);
        assert_eq!(settings.db_location, db_location);
        assert_eq!(settings.trash_location, trash_location);
        assert_eq!(settings.theme, "system");
        assert_eq!(settings.security_level, "strict");
    }

    #[test]
    fn saves_and_reads_settings_from_sqlite() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        let settings = AppSettings {
            scan_paths: vec![
                "/Users/test/.codex".to_string(),
                "/Users/test/workspace/.claude".to_string(),
            ],
            include_project_local: false,
            enable_deep_scan: true,
            db_location: "/tmp/custom/data.db".to_string(),
            trash_location: "/tmp/custom/Trash".to_string(),
            theme: "dark".to_string(),
            security_level: "balanced".to_string(),
        };

        save_settings(&conn, &settings).unwrap();

        let reloaded = get_settings(
            &conn,
            &["/Users/test/.ignored".to_string()],
            "/tmp/ignored/data.db",
            "/tmp/ignored/Trash",
        )
        .unwrap();

        assert_eq!(reloaded.scan_paths, settings.scan_paths);
        assert_eq!(
            reloaded.include_project_local,
            settings.include_project_local
        );
        assert_eq!(reloaded.enable_deep_scan, settings.enable_deep_scan);
        assert_eq!(reloaded.db_location, settings.db_location);
        assert_eq!(reloaded.trash_location, settings.trash_location);
        assert_eq!(reloaded.theme, settings.theme);
        assert_eq!(reloaded.security_level, settings.security_level);
    }

    #[test]
    fn run_migrations_is_idempotent_and_records_applied_versions() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = '2026-06-13-settings-persistence'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let operations_exists: String = conn
            .query_row(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'operations'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(operations_exists, "operations");
    }

    #[test]
    fn creates_and_reads_model_profiles() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        let profile = ModelProfile {
            id: "profile-1".to_string(),
            name: "OpenAI Default".to_string(),
            provider: "OpenAI".to_string(),
            model_id: "gpt-5.1-codex".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            key_storage: "env".to_string(),
            env_key_names: vec!["OPENAI_API_KEY".to_string()],
            notes: "Default OpenAI coding profile".to_string(),
            created_at: "2026-06-13T10:00:00Z".to_string(),
            updated_at: "2026-06-13T10:00:00Z".to_string(),
        };

        insert_model_profile(&conn, &profile).unwrap();
        let rows = get_model_profiles(&conn).unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].provider, "OpenAI");
        assert_eq!(rows[0].env_key_names, vec!["OPENAI_API_KEY".to_string()]);
    }

    #[test]
    fn get_db_connection_at_path_initializes_base_schema_for_new_database() {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let db_dir = std::env::temp_dir().join(format!("agent-assets-manager-db-test-{unique_id}"));
        let db_path = db_dir.join("data.db");

        let conn = get_db_connection_at_path(&db_path).unwrap();

        let table_name: String = conn
            .query_row(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'installations'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_name, "installations");

        std::fs::remove_file(&db_path).ok();
        std::fs::remove_dir_all(&db_dir).ok();
    }

    #[test]
    fn get_all_assets_returns_installations_grouped_correctly() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();
        run_migrations(&conn).unwrap();

        conn.execute(
            "INSERT INTO platforms (id, name, kind, writable, detected_at, status, asset_count, warning_count) VALUES ('p1', 'Claude', 'claude', 'readonly', '2026-01-01', 'active', 0, 0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO platforms (id, name, kind, writable, detected_at, status, asset_count, warning_count) VALUES ('p2', 'Codex', 'codex', 'partial', '2026-01-01', 'active', 0, 0)",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO assets (id, asset_type, name, source, risk_level, status, created_at, updated_at) VALUES ('a1', 'Skill', 'my-skill', 'local', 'low', 'installed', '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO assets (id, asset_type, name, source, risk_level, status, created_at, updated_at) VALUES ('a2', 'Agent', 'my-agent', 'local', 'low', 'installed', '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i1', 'a1', 'p1', '/home/.claude/skills/my-skill', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i2', 'a1', 'p2', '/home/.codex/skills/my-skill', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i3', 'a2', 'p1', '/home/.claude/agents/my-agent', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();

        let assets = get_all_assets(&conn).unwrap();

        assert_eq!(assets.len(), 2);
        let a1 = assets.iter().find(|a| a.id == "a1").unwrap();
        let a2 = assets.iter().find(|a| a.id == "a2").unwrap();
        assert_eq!(a1.installations.len(), 2);
        assert_eq!(a2.installations.len(), 1);
        let i1 = a1.installations.iter().find(|i| i.id == "i1").unwrap();
        assert_eq!(i1.platform_name, "Claude");
    }
}
