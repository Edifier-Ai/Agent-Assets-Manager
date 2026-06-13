use std::fs;

#[test]
fn preview_delete_rejects_protected_assets() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "delete".to_string(),
            target_id: Some("asset-1".to_string()),
            target_name: "Builtin Skill".to_string(),
            target_type: "Skill".to_string(),
            target_path: "~/.codex/skills/builtin-skill/SKILL.md".to_string(),
            source_path: None,
            official: true,
            risk_level: Some("medium".to_string()),
            platform_id: None,
        })
        .unwrap();

    assert!(!preview.supported);
    assert!(preview.risks.iter().any(|risk| risk.contains("官方")));
}

#[test]
fn execute_delete_writes_operation_log_and_backup_record() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-operations-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let db_path = test_root.join("data.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = rusqlite::Connection::open(&db_path).unwrap();

    let asset_path = test_root.join("user-skill.txt");
    fs::write(&asset_path, "hello").unwrap();

    let result = crate::operations::execute_operation(
        &conn,
        crate::operations::ExecuteOperationRequest {
            preview: crate::operations::PreviewOperationRequest {
                operation_type: "delete".to_string(),
                target_id: Some("asset-user-1".to_string()),
                target_name: "User Skill".to_string(),
                target_type: "Skill".to_string(),
                target_path: asset_path.to_string_lossy().to_string(),
                source_path: None,
                official: false,
                risk_level: Some("low".to_string()),
                platform_id: None,
            },
        },
    )
    .unwrap();

    assert_eq!(result.operation_type, "delete");
    assert!(!asset_path.exists());

    let operation_row: (String, String) = conn
        .query_row(
            "SELECT operation_type, status FROM operations WHERE id = ?1",
            [&result.operation_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(operation_row.0, "delete");
    assert_eq!(operation_row.1, "completed");

    let backup_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM backups WHERE operation_id = ?1",
            [&result.operation_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(backup_count, 1);

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn preview_apply_model_profile_reports_supported_platforms() {
    let writable_preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "apply-model-profile".to_string(),
            target_id: Some("profile-1".to_string()),
            target_name: "OpenAI Default".to_string(),
            target_type: "Model Profile".to_string(),
            target_path: "~/.opencode/config.yaml".to_string(),
            source_path: None,
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("opencode".to_string()),
        })
        .unwrap();
    assert!(writable_preview.supported);
    assert_eq!(writable_preview.operation_type, "apply-model-profile");
    assert!(writable_preview
        .written_keys
        .iter()
        .any(|key| key == "provider"));

    let readonly_preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "apply-model-profile".to_string(),
            target_id: Some("profile-1".to_string()),
            target_name: "OpenAI Default".to_string(),
            target_type: "Model Profile".to_string(),
            target_path: "~/.claude/config.json".to_string(),
            source_path: None,
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("claude".to_string()),
        })
        .unwrap();
    assert!(!readonly_preview.supported);
    assert!(readonly_preview
        .risks
        .iter()
        .any(|risk| risk.contains("只读")));
}

#[test]
fn preview_operation_supports_apply_model_profile_requests() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "apply-model-profile".to_string(),
            target_id: Some("profile-1".to_string()),
            target_name: "OpenAI Default".to_string(),
            target_type: "Model Profile".to_string(),
            target_path: "~/.opencode/config.yaml".to_string(),
            source_path: None,
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("opencode".to_string()),
        })
        .unwrap();

    assert!(preview.supported);
    assert_eq!(preview.operation_type, "apply-model-profile");
    assert!(preview
        .files_to_modify
        .iter()
        .any(|path| path.contains("config.yaml")));
}

#[test]
fn preview_install_asset_reports_copy_target_and_backup_risk() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "install-asset".to_string(),
            target_id: Some("asset-1".to_string()),
            target_name: "review".to_string(),
            target_type: "Command".to_string(),
            target_path: "~/.kimi-code/commands/review.md".to_string(),
            source_path: Some("~/.codex/commands/review.md".to_string()),
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("kimi".to_string()),
        })
        .unwrap();

    assert!(preview.supported);
    assert_eq!(preview.operation_type, "install-asset");
    assert!(preview
        .files_to_modify
        .iter()
        .any(|path| path.contains("review.md")));
    assert!(preview
        .backup_paths
        .iter()
        .any(|path| path.contains("review.md")));
    assert!(preview.needs_restart);
}

#[test]
fn preview_install_asset_rejects_readonly_platforms() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "install-asset".to_string(),
            target_id: Some("asset-1".to_string()),
            target_name: "review".to_string(),
            target_type: "Command".to_string(),
            target_path: "~/.claude/commands/review.md".to_string(),
            source_path: Some("~/.codex/commands/review.md".to_string()),
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("claude".to_string()),
        })
        .unwrap();

    assert!(!preview.supported);
    assert!(preview.risks.iter().any(|risk| risk.contains("只读")));
}

#[test]
fn preview_install_asset_rejects_unsupported_asset_types() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "install-asset".to_string(),
            target_id: Some("asset-1".to_string()),
            target_name: "persona".to_string(),
            target_type: "Persona".to_string(),
            target_path: "~/.gemini/personas/persona.md".to_string(),
            source_path: Some("~/.codex/personas/persona.md".to_string()),
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("gemini".to_string()),
        })
        .unwrap();

    assert!(!preview.supported);
    assert!(preview.risks.iter().any(|risk| risk.contains("不支持")));
}

#[test]
fn execute_install_asset_copies_source_and_records_installation() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-install-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let db_path = test_root.join("data.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = rusqlite::Connection::open(&db_path).unwrap();

    crate::db::insert_platform(
        &conn,
        &crate::db::Platform {
            id: "kimi".to_string(),
            name: "Kimi".to_string(),
            kind: "kimi".to_string(),
            cli_path: None,
            version: None,
            config_roots: vec![test_root.join("kimi").to_string_lossy().to_string()],
            writable: "partial".to_string(),
            detected_at: "2026-06-13T10:00:00Z".to_string(),
            status: "active".to_string(),
            asset_count: 0,
            warning_count: 0,
        },
    )
    .unwrap();

    let source_path = test_root.join("review.md");
    let target_path = test_root.join("kimi").join("commands").join("review.md");
    fs::write(&source_path, "# Review\n").unwrap();
    crate::db::insert_asset(
        &conn,
        &crate::db::Asset {
            id: "asset-command-review".to_string(),
            asset_type: "Command".to_string(),
            name: "review".to_string(),
            description: Some("review command".to_string()),
            author: Some("Local".to_string()),
            version: Some("0.1.0".to_string()),
            source: "test".to_string(),
            canonical_hash: None,
            directory_hash: None,
            risk_level: "medium".to_string(),
            status: "installed,user-installed".to_string(),
            created_at: "2026-06-13T10:00:00Z".to_string(),
            updated_at: "2026-06-13T10:00:00Z".to_string(),
            installations: Vec::new(),
        },
    )
    .unwrap();

    let result = crate::operations::execute_operation(
        &conn,
        crate::operations::ExecuteOperationRequest {
            preview: crate::operations::PreviewOperationRequest {
                operation_type: "install-asset".to_string(),
                target_id: Some("asset-command-review".to_string()),
                target_name: "review".to_string(),
                target_type: "Command".to_string(),
                target_path: target_path.to_string_lossy().to_string(),
                source_path: Some(source_path.to_string_lossy().to_string()),
                official: false,
                risk_level: Some("medium".to_string()),
                platform_id: Some("kimi".to_string()),
            },
        },
    )
    .unwrap();

    assert_eq!(result.operation_type, "install-asset");
    assert_eq!(fs::read_to_string(&target_path).unwrap(), "# Review\n");

    let installation_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM installations WHERE asset_id = ?1 AND platform_id = ?2 AND path = ?3",
            (
                "asset-command-review",
                "kimi",
                target_path.to_string_lossy().to_string(),
            ),
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(installation_count, 1);

    let operation_row: (String, String) = conn
        .query_row(
            "SELECT operation_type, status FROM operations WHERE id = ?1",
            [&result.operation_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(operation_row.0, "install-asset");
    assert_eq!(operation_row.1, "completed");

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn execute_apply_model_profile_updates_config_and_writes_log() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-apply-profile-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let db_path = test_root.join("data.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = rusqlite::Connection::open(&db_path).unwrap();

    let profile = crate::db::ModelProfile {
        id: "profile-apply-1".to_string(),
        name: "OpenAI Default".to_string(),
        provider: "OpenAI".to_string(),
        model_id: "gpt-5".to_string(),
        base_url: "https://api.openai.com/v1".to_string(),
        key_storage: "env".to_string(),
        env_key_names: vec!["OPENAI_API_KEY".to_string()],
        notes: "default".to_string(),
        created_at: "2026-06-13T10:00:00Z".to_string(),
        updated_at: "2026-06-13T10:00:00Z".to_string(),
    };
    crate::db::insert_model_profile(&conn, &profile).unwrap();

    let config_path = test_root.join("config.yaml");
    fs::write(
        &config_path,
        "provider: Anthropic\nmodel: claude-3-5-sonnet\nbase_url: https://api.anthropic.com\n",
    )
    .unwrap();

    let result = crate::operations::execute_operation(
        &conn,
        crate::operations::ExecuteOperationRequest {
            preview: crate::operations::PreviewOperationRequest {
                operation_type: "apply-model-profile".to_string(),
                target_id: Some(profile.id.clone()),
                target_name: profile.name.clone(),
                target_type: "Model Profile".to_string(),
                target_path: config_path.to_string_lossy().to_string(),
                source_path: None,
                official: false,
                risk_level: Some("medium".to_string()),
                platform_id: Some("opencode".to_string()),
            },
        },
    )
    .unwrap();

    let content = fs::read_to_string(&config_path).unwrap();
    assert!(content.contains("provider: OpenAI"));
    assert!(content.contains("model: gpt-5"));
    assert!(content.contains("base_url: https://api.openai.com/v1"));
    assert_eq!(result.operation_type, "apply-model-profile");

    let operation_row: (String, String) = conn
        .query_row(
            "SELECT operation_type, status FROM operations WHERE id = ?1",
            [&result.operation_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(operation_row.0, "apply-model-profile");
    assert_eq!(operation_row.1, "completed");

    let backup_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM backups WHERE operation_id = ?1",
            [&result.operation_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(backup_count, 1);

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn execute_apply_model_profile_preserves_unrelated_yaml_keys() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-apply-profile-merge-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let db_path = test_root.join("data.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = rusqlite::Connection::open(&db_path).unwrap();

    let profile = crate::db::ModelProfile {
        id: "profile-apply-merge-1".to_string(),
        name: "OpenAI Default".to_string(),
        provider: "OpenAI".to_string(),
        model_id: "gpt-5".to_string(),
        base_url: "https://api.openai.com/v1".to_string(),
        key_storage: "env".to_string(),
        env_key_names: vec!["OPENAI_API_KEY".to_string()],
        notes: "default".to_string(),
        created_at: "2026-06-13T10:00:00Z".to_string(),
        updated_at: "2026-06-13T10:00:00Z".to_string(),
    };
    crate::db::insert_model_profile(&conn, &profile).unwrap();

    let config_path = test_root.join("config.yaml");
    fs::write(
        &config_path,
        "provider: Anthropic\nmodel: claude-3-5-sonnet\nbase_url: https://api.anthropic.com\ntemperature: 0.2\n",
    )
    .unwrap();

    crate::operations::execute_operation(
        &conn,
        crate::operations::ExecuteOperationRequest {
            preview: crate::operations::PreviewOperationRequest {
                operation_type: "apply-model-profile".to_string(),
                target_id: Some(profile.id.clone()),
                target_name: profile.name.clone(),
                target_type: "Model Profile".to_string(),
                target_path: config_path.to_string_lossy().to_string(),
                source_path: None,
                official: false,
                risk_level: Some("medium".to_string()),
                platform_id: Some("opencode".to_string()),
            },
        },
    )
    .unwrap();

    let content = fs::read_to_string(&config_path).unwrap();
    assert!(content.contains("provider: OpenAI"));
    assert!(content.contains("model: gpt-5"));
    assert!(content.contains("temperature: 0.2"));

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn create_backup_generates_unique_paths_for_repeated_backups() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-backup-unique-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let file_path = test_root.join("config.json");
    fs::write(&file_path, r#"{"model":"old"}"#).unwrap();

    let first = crate::fileops::create_backup(&file_path.to_string_lossy()).unwrap();
    let second = crate::fileops::create_backup(&file_path.to_string_lossy()).unwrap();

    assert_ne!(first, second);
    assert!(std::path::Path::new(&first).exists());
    assert!(std::path::Path::new(&second).exists());

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn execute_restore_backs_up_conflicting_target_and_links_operation_log() {
    let test_root = std::env::temp_dir().join(format!(
        "agent-assets-manager-restore-conflict-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(&test_root).unwrap();

    let db_path = test_root.join("data.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = rusqlite::Connection::open(&db_path).unwrap();

    let target_path = test_root.join("config.json");
    let backup_path = test_root.join("backup-config.json");
    fs::write(&target_path, r#"{"model":"current"}"#).unwrap();
    fs::write(&backup_path, r#"{"model":"restored"}"#).unwrap();

    let result = crate::operations::execute_operation(
        &conn,
        crate::operations::ExecuteOperationRequest {
            preview: crate::operations::PreviewOperationRequest {
                operation_type: "restore".to_string(),
                target_id: Some("backup-1".to_string()),
                target_name: "config backup".to_string(),
                target_type: "Backup".to_string(),
                target_path: target_path.to_string_lossy().to_string(),
                source_path: Some(backup_path.to_string_lossy().to_string()),
                official: false,
                risk_level: Some("medium".to_string()),
                platform_id: None,
            },
        },
    )
    .unwrap();

    assert_eq!(
        fs::read_to_string(&target_path).unwrap(),
        r#"{"model":"restored"}"#
    );

    let backups = crate::db::get_all_backups(&conn).unwrap();
    assert_eq!(backups.len(), 1);
    assert_eq!(result.backup_id, Some(backups[0].id.clone()));
    assert_eq!(backups[0].operation_type, "restore");

    let operation_backup_id: Option<String> = conn
        .query_row(
            "SELECT backup_id FROM operations WHERE id = ?1",
            [&result.operation_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(operation_backup_id, result.backup_id);

    fs::remove_dir_all(&test_root).unwrap();
}

#[test]
fn preview_apply_model_profile_rejects_formats_not_declared_by_adapter() {
    let preview =
        crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
            operation_type: "apply-model-profile".to_string(),
            target_id: Some("profile-1".to_string()),
            target_name: "OpenAI Default".to_string(),
            target_type: "Model Profile".to_string(),
            target_path: "~/.opencode/config.json".to_string(),
            source_path: None,
            official: false,
            risk_level: Some("medium".to_string()),
            platform_id: Some("opencode".to_string()),
        })
        .unwrap();

    assert!(!preview.supported);
    assert!(preview
        .risks
        .iter()
        .any(|risk| risk.contains("格式") || risk.contains("adapter")));
}
