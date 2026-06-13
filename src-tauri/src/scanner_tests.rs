use crate::adapters::PlatformAdapter;
use crate::platform::PlatformKind;
use rusqlite::Connection;
use std::fs;

struct ModelConfigTestAdapter {
    root: String,
    configs: Vec<crate::adapters::ModelConfigSpec>,
}

impl PlatformAdapter for ModelConfigTestAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::GenericCli
    }

    fn binary_names(&self) -> Vec<&'static str> {
        Vec::new()
    }

    fn config_roots(&self) -> Vec<String> {
        vec![self.root.clone()]
    }

    fn writable_status(&self) -> &'static str {
        "readonly"
    }

    fn asset_search_specs(&self) -> Vec<crate::adapters::AssetSearchSpec> {
        vec![
            crate::adapters::AssetSearchSpec {
                subdir: "commands",
                pattern: ".md",
                asset_type: "Command",
            },
            crate::adapters::AssetSearchSpec {
                subdir: "alt-commands",
                pattern: ".md",
                asset_type: "Command",
            },
        ]
    }

    fn model_config_files(&self) -> Vec<crate::adapters::ModelConfigSpec> {
        self.configs.clone()
    }
}

#[test]
fn generic_cli_adapter_can_be_registered_as_read_only() {
    let adapter = crate::adapters::generic_cli::GenericCliAdapter::default();

    assert_eq!(adapter.kind(), PlatformKind::GenericCli);
    assert_eq!(adapter.kind().as_str(), "generic");
    assert_eq!(adapter.writable_status(), "readonly");
}

#[test]
fn adapter_registry_includes_all_supported_platforms() {
    let mut kinds = crate::adapters::all_adapters()
        .into_iter()
        .map(|adapter| adapter.kind().as_str().to_string())
        .collect::<Vec<_>>();

    kinds.sort();

    assert_eq!(
        kinds,
        vec![
            "claude", "codex", "cursor", "gemini", "hermes", "kimi", "openclaw", "opencode",
            "qwen", "trae"
        ]
    );
}

#[test]
fn scanner_can_scan_generic_cli_assets_via_adapter_specs() {
    let root = std::env::temp_dir().join(format!(
        "agent-assets-manager-generic-cli-{}",
        std::process::id()
    ));
    let commands_dir = root.join("commands");

    if root.exists() {
        fs::remove_dir_all(&root).unwrap();
    }

    fs::create_dir_all(&commands_dir).unwrap();
    fs::write(commands_dir.join("deploy.md"), "# deploy").unwrap();

    let db_path = root.join("scanner-test.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    let adapter = crate::adapters::generic_cli::GenericCliAdapter::with_roots(vec![root
        .to_string_lossy()
        .to_string()]);

    let result =
        crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)]).unwrap();

    assert_eq!(result.platforms_found, 1);
    assert_eq!(result.assets_found, 1);

    let assets = crate::db::get_all_assets(&conn).unwrap();
    assert_eq!(assets.len(), 1);
    assert_eq!(assets[0].asset_type, "Command");
    assert_eq!(assets[0].installations[0].platform_id, "generic");

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn scanner_can_scan_custom_roots_as_generic_cli_assets() {
    let root = std::env::temp_dir().join(format!(
        "agent-assets-manager-custom-root-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    let rules_dir = root.join("rules");

    if root.exists() {
        fs::remove_dir_all(&root).unwrap();
    }

    fs::create_dir_all(&rules_dir).unwrap();
    fs::write(rules_dir.join("review.md"), "# review").unwrap();

    let db_path = root.join("scanner-custom-root.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    let result = crate::scanner::run_full_scan_with_custom_roots(
        &conn,
        vec![root.to_string_lossy().to_string()],
    )
    .unwrap();

    assert_eq!(result.assets_found, 1);

    let assets = crate::db::get_all_assets(&conn).unwrap();
    assert_eq!(assets.len(), 1);
    assert_eq!(assets[0].asset_type, "Rule");
    assert_eq!(assets[0].installations[0].platform_id, "generic");

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn classifies_markdown_by_directory_context() {
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("rules", "policy.md"),
        "Rule"
    );
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("memories", "session.md"),
        "Memory"
    );
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("personas", "reviewer.md"),
        "Persona"
    );
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("commands", "build.md"),
        "Command"
    );
}

#[test]
fn scanner_marks_contextual_assets_and_generates_project_local_findings() {
    let root = std::env::temp_dir().join("Projects").join(format!(
        "agent-assets-manager-contextual-{}",
        std::process::id()
    ));
    let rules_dir = root.join("rules");
    let memories_dir = root.join("memories");
    let personas_dir = root.join("personas");

    if root.exists() {
        fs::remove_dir_all(&root).unwrap();
    }

    fs::create_dir_all(&rules_dir).unwrap();
    fs::create_dir_all(&memories_dir).unwrap();
    fs::create_dir_all(&personas_dir).unwrap();
    fs::write(rules_dir.join("policy.md"), "# policy").unwrap();
    fs::write(memories_dir.join("session.md"), "# session").unwrap();
    fs::write(personas_dir.join("reviewer.md"), "# reviewer").unwrap();

    let db_path = root.join("scanner-context.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    let adapter = crate::adapters::generic_cli::GenericCliAdapter::with_roots(vec![root
        .to_string_lossy()
        .to_string()]);

    let result =
        crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)]).unwrap();

    assert_eq!(result.assets_found, 3);
    assert_eq!(result.warnings_found, 3);

    let mut asset_types = crate::db::get_all_assets(&conn)
        .unwrap()
        .into_iter()
        .map(|asset| {
            assert!(
                asset.status.contains("project-local"),
                "expected project-local status for {}",
                asset.name
            );
            asset.asset_type
        })
        .collect::<Vec<_>>();
    asset_types.sort();

    assert_eq!(asset_types, vec!["Memory", "Persona", "Rule"]);

    let findings = crate::db::get_all_findings(&conn).unwrap();
    assert_eq!(findings.len(), 3);
    assert!(findings
        .iter()
        .all(|finding| finding.issue == "Project-local"));
    assert!(findings
        .iter()
        .all(|finding| finding.detail.contains("项目本地")));

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn scanner_parses_nested_model_config_schema_without_leaking_secret_values() {
    let root = std::env::temp_dir().join(format!(
        "agent-assets-manager-nested-model-config-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));

    if root.exists() {
        fs::remove_dir_all(&root).unwrap();
    }

    fs::create_dir_all(root.join("commands")).unwrap();
    fs::write(root.join("commands").join("ship.md"), "# ship").unwrap();
    fs::write(
        root.join("config.json"),
        r#"{
          "providers": {
            "default": "openai",
            "openai": {
              "model": "gpt-5",
              "base_url": "https://api.openai.com/v1",
              "api_key": "sk-live-secret"
            }
          }
        }"#,
    )
    .unwrap();
    fs::write(
        root.join("config.yaml"),
        "model:\n  provider: Kimi\n  id: kimi-k2.6\n  base_url: https://api.moonshot.cn\n",
    )
    .unwrap();
    fs::write(
        root.join("config.toml"),
        "[model]\nprovider = \"OpenRouter\"\nid = \"anthropic/claude-sonnet\"\nbase_url = \"https://openrouter.ai/api/v1\"\n",
    )
    .unwrap();

    let db_path = root.join("scanner-models.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    let adapter = ModelConfigTestAdapter {
        root: root.to_string_lossy().to_string(),
        configs: vec![
            crate::adapters::ModelConfigSpec {
                filename: "config.json",
                format: "json",
                writable_keys: crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                merge_strategy: crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
            },
            crate::adapters::ModelConfigSpec {
                filename: "config.yaml",
                format: "yaml",
                writable_keys: crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                merge_strategy: crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
            },
            crate::adapters::ModelConfigSpec {
                filename: "config.toml",
                format: "toml",
                writable_keys: crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                merge_strategy: crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
            },
        ],
    };

    crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)]).unwrap();

    let bindings = crate::db::get_all_model_bindings(&conn).unwrap();
    assert_eq!(bindings.len(), 3);
    assert!(bindings.iter().any(|binding| {
        binding.detected_provider == "openai"
            && binding.detected_model_id == "gpt-5"
            && binding.detected_base_url.as_deref() == Some("https://api.openai.com/v1")
            && binding.key_presence
            && binding.key_suffix == Some("****".to_string())
            && !binding.warnings.contains("sk-live-secret")
    }));
    assert!(bindings
        .iter()
        .any(|binding| binding.detected_provider == "Kimi"
            && binding.detected_model_id == "kimi-k2.6"));
    assert!(bindings.iter().any(|binding| {
        binding.detected_provider == "OpenRouter"
            && binding.detected_model_id == "anthropic/claude-sonnet"
    }));

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}

#[test]
fn scanner_skips_secret_like_asset_files_and_reports_name_conflicts() {
    let root = std::env::temp_dir().join(format!(
        "agent-assets-manager-secret-conflict-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    let commands_dir = root.join("commands");
    let alt_commands_dir = root.join("alt-commands");

    if root.exists() {
        fs::remove_dir_all(&root).unwrap();
    }

    fs::create_dir_all(&commands_dir).unwrap();
    fs::create_dir_all(&alt_commands_dir).unwrap();
    fs::write(commands_dir.join("deploy.md"), "# deploy\nold").unwrap();
    fs::write(alt_commands_dir.join("deploy.md"), "# deploy\nnew").unwrap();
    fs::write(commands_dir.join(".env"), "OPENAI_API_KEY=sk-secret").unwrap();
    fs::write(commands_dir.join("tokens.json"), r#"{"token":"secret"}"#).unwrap();

    let db_path = root.join("scanner-conflicts.db");
    crate::db::init_db(&db_path).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    let adapter = ModelConfigTestAdapter {
        root: root.to_string_lossy().to_string(),
        configs: Vec::new(),
    };

    crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)]).unwrap();

    let assets = crate::db::get_all_assets(&conn).unwrap();
    assert_eq!(assets.len(), 2);
    assert!(assets.iter().all(|asset| !asset.name.contains("token")));

    let findings = crate::db::get_all_findings(&conn).unwrap();
    assert!(findings
        .iter()
        .any(|finding| { finding.issue == "Conflict" && finding.detail.contains("同名") }));

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}
