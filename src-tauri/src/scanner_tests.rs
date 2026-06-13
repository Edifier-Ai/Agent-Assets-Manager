use crate::adapters::PlatformAdapter;
use crate::platform::PlatformKind;
use rusqlite::Connection;
use std::fs;

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
        vec!["claude", "codex", "generic", "hermes", "openclaw", "opencode"]
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

    let adapter = crate::adapters::generic_cli::GenericCliAdapter::with_roots(vec![
        root.to_string_lossy().to_string(),
    ]);

    let result = crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)])
        .unwrap();

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
    let root = std::env::temp_dir()
        .join("Projects")
        .join(format!("agent-assets-manager-contextual-{}", std::process::id()));
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

    let adapter = crate::adapters::generic_cli::GenericCliAdapter::with_roots(vec![
        root.to_string_lossy().to_string(),
    ]);

    let result = crate::scanner::run_full_scan_with_adapters(&conn, vec![Box::new(adapter)])
        .unwrap();

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
    assert!(findings.iter().all(|finding| finding.issue == "Project-local"));
    assert!(findings
        .iter()
        .all(|finding| finding.detail.contains("项目本地")));

    drop(conn);
    fs::remove_dir_all(&root).unwrap();
}
