mod models;
mod schema;
mod connection;
mod queries;

pub use models::*;
pub use schema::{init_db, run_migrations};
pub use connection::{get_db_connection, get_db_connection_at_path, default_db_path, default_trash_path};
pub use queries::*;

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
        schema::create_tables(&conn).unwrap();

        let (scan_paths, db_location, trash_location) = test_paths();
        let settings = get_settings(&conn, &scan_paths, &db_location, &trash_location).unwrap();

        assert_eq!(settings.scan_paths, scan_paths);
        assert!(settings.include_project_local);
        assert!(!settings.enable_deep_scan);
        assert_eq!(settings.db_location, db_location);
        assert_eq!(settings.trash_location, trash_location);
        assert_eq!(settings.theme, "system");
        assert_eq!(settings.security_level, "strict");
        assert!(settings.ignored_platform_ids.is_empty());
    }

    #[test]
    fn saves_and_reads_settings_from_sqlite() {
        let conn = Connection::open_in_memory().unwrap();
        schema::create_tables(&conn).unwrap();

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
            ignored_platform_ids: vec!["claude-app".to_string()],
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
        assert_eq!(reloaded.ignored_platform_ids, settings.ignored_platform_ids);
    }

    #[test]
    fn run_migrations_is_idempotent_and_records_applied_versions() {
        let conn = Connection::open_in_memory().unwrap();
        schema::create_tables(&conn).unwrap();

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
        schema::create_tables(&conn).unwrap();

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
        schema::create_tables(&conn).unwrap();
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

    #[test]
    fn get_all_operation_logs_returns_rows_newest_first() {
        let conn = Connection::open_in_memory().unwrap();
        schema::create_tables(&conn).unwrap();
        run_migrations(&conn).unwrap();

        conn.execute(
            "INSERT INTO operations (id, operation_type, status, target_type, target_path, preview_json, result_json, created_at)
             VALUES ('op1', 'delete', 'completed', 'Skill', '/path/a', '{}', '{}', '2026-06-13T08:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO operations (id, operation_type, status, target_type, target_path, preview_json, result_json, created_at)
             VALUES ('op2', 'restore', 'completed', 'Backup', '/path/b', '{}', '{}', '2026-06-13T09:00:00Z')",
            [],
        ).unwrap();

        let logs = get_all_operation_logs(&conn).unwrap();

        assert_eq!(logs.len(), 2);
        assert_eq!(logs[0].id, "op2");
        assert_eq!(logs[1].id, "op1");
        assert_eq!(logs[0].operation_type, "restore");
    }
}
