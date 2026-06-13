use std::fs;

#[test]
fn preview_delete_rejects_protected_assets() {
    let preview = crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
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
    let writable_preview = crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
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

    let readonly_preview = crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
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
    let preview = crate::operations::preview_operation(crate::operations::PreviewOperationRequest {
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
    assert!(preview.files_to_modify.iter().any(|path| path.contains("config.yaml")));
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
