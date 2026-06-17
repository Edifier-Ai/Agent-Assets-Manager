use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};

pub(crate) const SETTINGS_MIGRATION_VERSION: &str = "2026-06-13-settings-persistence";

pub fn init_db(db_path: &std::path::Path) -> SqlResult<()> {
    let conn = Connection::open(db_path)?;
    create_tables(&conn)?;
    run_migrations(&conn)?;
    Ok(())
}

pub(crate) fn create_tables(conn: &Connection) -> SqlResult<()> {
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

        CREATE INDEX IF NOT EXISTS idx_installations_asset_id ON installations(asset_id);
        CREATE INDEX IF NOT EXISTS idx_installations_platform_id ON installations(platform_id);
        CREATE INDEX IF NOT EXISTS idx_findings_asset_id ON findings(asset_id);
        CREATE INDEX IF NOT EXISTS idx_findings_platform_id ON findings(platform_id);
        CREATE INDEX IF NOT EXISTS idx_model_bindings_platform_id ON model_bindings(platform_id);
        CREATE INDEX IF NOT EXISTS idx_backups_operation_id ON backups(operation_id);

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

        CREATE INDEX IF NOT EXISTS idx_scan_steps_scan_run_id ON scan_steps(scan_run_id);
        CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);
        "#,
    )?;

    conn.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        params![SETTINGS_MIGRATION_VERSION, chrono::Utc::now().to_rfc3339()],
    )?;

    Ok(())
}
