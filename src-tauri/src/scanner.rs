use crate::adapters::{self, AssetSearchSpec, ModelConfigSpec, PlatformAdapter};
use crate::db;
use crate::db::{Asset, Finding, Installation, ModelBinding, Platform as DbPlatform, ScanRun};
use crate::fileops;
use regex::Regex;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

const SCAN_STEP_DEFINITIONS: [(&str, &str, &str); 6] = [
    (
        "detect-platforms",
        "检测已安装平台",
        "扫描 PATH 和常见安装路径中的 Agent CLI",
    ),
    (
        "scan-assets",
        "扫描已知资产位置",
        "在平台配置目录中搜索 SKILL.md、AGENTS.md 等",
    ),
    (
        "parse-metadata",
        "解析元数据",
        "提取 frontmatter、标题、作者、版本等信息",
    ),
    (
        "deduplicate-assets",
        "指纹计算与去重",
        "计算内容哈希，识别重复和冲突资产",
    ),
    (
        "classify-findings",
        "状态分类",
        "标记官方、用户安装、项目本地、风险等级",
    ),
    (
        "write-index",
        "写入本地索引",
        "将扫描结果写入 SQLite 数据库",
    ),
];

struct AdapterSnapshot {
    config_roots: Vec<String>,
    asset_search_specs: Vec<AssetSearchSpec>,
    model_config_files: Vec<ModelConfigSpec>,
}

pub fn record_scan_step(
    conn: &Connection,
    scan_run_id: &str,
    step_key: &str,
    title: &str,
    description: &str,
    status: &str,
    detail: Option<&str>,
    order_index: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    let now = chrono::Utc::now().to_rfc3339();
    db::insert_scan_step(
        conn,
        &db::ScanStep {
            id: format!("{scan_run_id}-{step_key}"),
            scan_run_id: scan_run_id.to_string(),
            step_key: step_key.to_string(),
            title: title.to_string(),
            description: description.to_string(),
            status: status.to_string(),
            detail: detail.map(str::to_string),
            order_index,
            started_at: Some(now.clone()),
            completed_at: matches!(status, "completed" | "warning" | "error").then_some(now),
        },
    )?;
    Ok(())
}

pub fn run_full_scan(conn: &Connection) -> Result<ScanResult, Box<dyn std::error::Error>> {
    run_full_scan_with_adapters(conn, adapters::all_adapters())
}

pub fn run_full_scan_with_custom_roots(
    conn: &Connection,
    custom_roots: Vec<String>,
) -> Result<ScanResult, Box<dyn std::error::Error>> {
    let roots = sanitize_custom_roots(custom_roots);

    if roots.is_empty() {
        return run_full_scan(conn);
    }

    run_full_scan_with_adapters(
        conn,
        vec![Box::new(
            adapters::generic_cli::GenericCliAdapter::with_roots(roots),
        )],
    )
}

pub fn run_full_scan_with_extra_roots(
    conn: &Connection,
    extra_roots: Vec<String>,
) -> Result<ScanResult, Box<dyn std::error::Error>> {
    let roots = sanitize_custom_roots(extra_roots);

    if roots.is_empty() {
        return run_full_scan(conn);
    }

    let mut adapter_list = adapters::all_adapters();
    adapter_list.push(Box::new(
        adapters::generic_cli::GenericCliAdapter::with_roots(roots),
    ));
    run_full_scan_with_adapters(conn, adapter_list)
}

fn sanitize_custom_roots(custom_roots: Vec<String>) -> Vec<String> {
    let mut roots = custom_roots
        .into_iter()
        .map(|root| root.trim().to_string())
        .filter(|root| !root.is_empty())
        .collect::<Vec<_>>();
    roots.sort();
    roots.dedup();
    roots
}

pub fn run_full_scan_with_adapters(
    conn: &Connection,
    adapter_list: Vec<Box<dyn PlatformAdapter>>,
) -> Result<ScanResult, Box<dyn std::error::Error>> {
    let start = chrono::Utc::now();
    let run_id = format!("scan-{}", start.timestamp());
    let adapter_snapshots = adapter_list
        .iter()
        .map(|adapter| {
            let kind = adapter.kind();
            (
                kind.as_str().to_string(),
                AdapterSnapshot {
                    config_roots: adapter.config_roots(),
                    asset_search_specs: adapter.asset_search_specs(),
                    model_config_files: adapter.model_config_files(),
                },
            )
        })
        .collect::<HashMap<_, _>>();

    let mut platforms = crate::platform::detect_platforms_with_adapters(adapter_list);
    let mut assets: Vec<Asset> = Vec::new();
    let mut findings: Vec<Finding> = Vec::new();
    let mut model_bindings: Vec<ModelBinding> = Vec::new();
    let mut content_hashes: HashMap<String, Vec<String>> = HashMap::new();

    db::clear_scan_data(conn)?;
    db::insert_scan_run(
        conn,
        &ScanRun {
            id: run_id.clone(),
            started_at: start.to_rfc3339(),
            completed_at: None,
            status: "running".to_string(),
            platforms_found: 0,
            assets_found: 0,
            duplicates_found: 0,
            warnings_found: 0,
            steps: Vec::new(),
        },
    )?;

    // Step 1: Detect platforms
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[0];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        0,
    )?;
    for dp in &platforms {
        let platform = DbPlatform {
            id: dp.id.clone(),
            name: dp.kind.display_name().to_string(),
            kind: dp.kind.as_str().to_string(),
            cli_path: dp.cli_path.clone(),
            version: dp.version.clone(),
            config_roots: dp.config_roots.clone(),
            writable: dp.writable.clone(),
            detected_at: dp.detected_at.clone(),
            status: dp.status.clone(),
            asset_count: 0,
            warning_count: 0,
        };
        db::insert_platform(conn, &platform)?;
    }
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some(&format!("发现 {} 个平台", platforms.len())),
        0,
    )?;

    // Step 2: Scan assets in each platform
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[1];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        1,
    )?;
    for dp in &platforms {
        let Some(adapter) = adapter_snapshots.get(&dp.id) else {
            continue;
        };

        for spec in &adapter.asset_search_specs {
            for root in &adapter.config_roots {
                let search_path = Path::new(root).join(spec.subdir);
                if !search_path.exists() {
                    continue;
                }

                if spec.pattern == "SKILL.md" || spec.pattern == "AGENTS.md" {
                    scan_skill_files(
                        conn,
                        &search_path,
                        spec.pattern,
                        &dp.id,
                        &dp.kind.display_name().to_string(),
                        &mut assets,
                        &mut findings,
                        &mut content_hashes,
                    )?;
                } else if spec.pattern.ends_with(".md") {
                    scan_markdown_files(
                        conn,
                        &search_path,
                        spec.asset_type,
                        &dp.id,
                        &dp.kind.display_name().to_string(),
                        &mut assets,
                        &mut findings,
                        &mut content_hashes,
                    )?;
                } else if spec.pattern == ".json" {
                    scan_json_files(
                        conn,
                        &search_path,
                        spec.asset_type,
                        &dp.id,
                        &dp.kind.display_name().to_string(),
                        &mut assets,
                        &mut findings,
                        &mut content_hashes,
                    )?;
                }
            }
        }
    }
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some(&format!("扫描到 {} 个资产安装位置", assets.len())),
        1,
    )?;

    // Step 3: Parse asset and model metadata
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[2];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        2,
    )?;
    for dp in &platforms {
        let Some(adapter) = adapter_snapshots.get(&dp.id) else {
            continue;
        };

        for root in &adapter.config_roots {
            let root_path = Path::new(root);
            if !root_path.exists() {
                continue;
            }
            for config in &adapter.model_config_files {
                let config_path = root_path.join(config.filename);
                if config_path.exists() {
                    if let Ok(binding) = parse_model_config(
                        &config_path,
                        config.format,
                        &dp.id,
                        &dp.kind.display_name().to_string(),
                    ) {
                        model_bindings.push(binding);
                    }
                }
            }
        }
    }
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some(&format!(
            "解析 {} 个资产，发现 {} 份模型配置",
            assets.len(),
            model_bindings.len()
        )),
        2,
    )?;

    // Step 4: Deduplicate by hash
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[3];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        3,
    )?;
    let mut duplicates = 0;
    for (_hash, ids) in &content_hashes {
        if ids.len() > 1 {
            duplicates += 1;
            for asset_id in ids {
                if let Some(asset) = assets.iter_mut().find(|a| a.id == *asset_id) {
                    if !asset.status.contains("duplicate") {
                        asset.status = format!("{},duplicate", asset.status);
                    }
                }
            }
            // Create findings for duplicates
            let names: Vec<String> = ids
                .iter()
                .filter_map(|id| assets.iter().find(|a| a.id == *id))
                .map(|a| a.name.clone())
                .collect();
            if let Some(first) = assets.iter().find(|a| a.id == ids[0]) {
                findings.push(Finding {
                    id: format!("find-dup-{}", ids[0]),
                    asset_id: ids[0].clone(),
                    asset_name: first.name.clone(),
                    platform_id: first
                        .installations
                        .first()
                        .map(|i| i.platform_id.clone())
                        .unwrap_or_default(),
                    platform_name: first
                        .installations
                        .first()
                        .map(|i| i.platform_name.clone())
                        .unwrap_or_default(),
                    issue: "Duplicate".to_string(),
                    risk_level: "high".to_string(),
                    detail: format!(
                        "在多个平台中发现同名资产，内容哈希一致: {}",
                        names.join(", ")
                    ),
                });
            }
        }
    }
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some(&format!("发现 {} 组重复项", duplicates)),
        3,
    )?;

    // Step 5: Classify scan results
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[4];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        4,
    )?;
    append_conflict_findings(&mut findings, &assets);
    append_contextual_findings(&mut findings, &assets);
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some(&format!("生成 {} 条风险提示", findings.len())),
        4,
    )?;

    // Step 5: Save everything
    let (step_key, title, description) = SCAN_STEP_DEFINITIONS[5];
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "running",
        None,
        5,
    )?;
    for asset in &assets {
        db::insert_asset(conn, asset)?;
    }
    for binding in &model_bindings {
        db::insert_model_binding(conn, binding)?;
    }
    for finding in &findings {
        db::insert_finding(conn, finding)?;
    }

    // Step 6: Update platform counts
    for dp in &mut platforms {
        let count = assets
            .iter()
            .filter(|a| a.installations.iter().any(|i| i.platform_id == dp.id))
            .count() as i32;
        dp.asset_count = count;
        let warnings = findings.iter().filter(|f| f.platform_id == dp.id).count() as i32;
        dp.warning_count = warnings;
        let platform = DbPlatform {
            id: dp.id.clone(),
            name: dp.kind.display_name().to_string(),
            kind: dp.kind.as_str().to_string(),
            cli_path: dp.cli_path.clone(),
            version: dp.version.clone(),
            config_roots: dp.config_roots.clone(),
            writable: dp.writable.clone(),
            detected_at: dp.detected_at.clone(),
            status: dp.status.clone(),
            asset_count: count,
            warning_count: warnings,
        };
        db::insert_platform(conn, &platform)?;
    }
    record_scan_step(
        conn,
        &run_id,
        step_key,
        title,
        description,
        "completed",
        Some("索引已更新"),
        5,
    )?;

    let end = chrono::Utc::now();
    let run = ScanRun {
        id: run_id,
        started_at: start.to_rfc3339(),
        completed_at: Some(end.to_rfc3339()),
        status: "completed".to_string(),
        platforms_found: platforms.len() as i32,
        assets_found: assets.len() as i32,
        duplicates_found: duplicates,
        warnings_found: findings.len() as i32,
        steps: Vec::new(),
    };
    db::insert_scan_run(conn, &run)?;

    Ok(ScanResult {
        platforms_found: platforms.len() as i32,
        assets_found: assets.len() as i32,
        duplicates_found: duplicates,
        warnings_found: findings.len() as i32,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct ScanResult {
    pub platforms_found: i32,
    pub assets_found: i32,
    pub duplicates_found: i32,
    pub warnings_found: i32,
}

pub fn infer_asset_type_from_context(directory_name: &str, file_name: &str) -> &'static str {
    let directory = directory_name.to_ascii_lowercase();
    let file = file_name.to_ascii_lowercase();

    match directory.as_str() {
        "rules" | "rule" => "Rule",
        "memories" | "memory" => "Memory",
        "personas" | "persona" => "Persona",
        "agents" | "agent" => "Agent",
        "skills" | "skill" => "Skill",
        "commands" | "command" => "Command",
        "mcp" => "MCP Server",
        _ if file == "agents.md" => "Agent",
        _ if file == "skill.md" || file == "skill.mdx" => "Skill",
        _ => "Unknown",
    }
}

fn resolve_asset_type(search_path: &Path, file_path: &Path, fallback: &str) -> String {
    let directory_name = search_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let file_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let inferred = infer_asset_type_from_context(directory_name, file_name);

    if inferred == "Unknown" {
        fallback.to_string()
    } else {
        inferred.to_string()
    }
}

fn derive_scope_and_project_local(path: &Path) -> (String, bool) {
    let project_local = path
        .components()
        .any(|component| component.as_os_str() == "Projects");

    let scope = if project_local { "project" } else { "global" };
    (scope.to_string(), project_local)
}

fn build_asset_status(installations: &[Installation]) -> String {
    let mut parts = vec!["installed".to_string()];

    if installations
        .iter()
        .any(|installation| installation.enabled)
    {
        parts.push("enabled".to_string());
    } else {
        parts.push("disabled".to_string());
    }
    if installations
        .iter()
        .any(|installation| installation.official)
    {
        parts.push("official".to_string());
    }
    if installations
        .iter()
        .any(|installation| installation.project_local)
    {
        parts.push("project-local".to_string());
    }
    if installations
        .iter()
        .any(|installation| !installation.official)
    {
        parts.push("user-installed".to_string());
    }

    parts.join(",")
}

fn append_contextual_findings(findings: &mut Vec<Finding>, assets: &[Asset]) {
    for asset in assets {
        let Some(primary_installation) = asset.installations.first() else {
            continue;
        };

        if asset
            .installations
            .iter()
            .any(|installation| installation.project_local)
        {
            findings.push(Finding {
                id: format!("find-project-local-{}", asset.id),
                asset_id: asset.id.clone(),
                asset_name: asset.name.clone(),
                platform_id: primary_installation.platform_id.clone(),
                platform_name: primary_installation.platform_name.clone(),
                issue: "Project-local".to_string(),
                risk_level: "medium".to_string(),
                detail: format!(
                    "{} 位于项目本地目录，可能导致跨项目行为不一致",
                    asset.asset_type
                ),
            });
        }
    }
}

fn append_conflict_findings(findings: &mut Vec<Finding>, assets: &[Asset]) {
    let mut grouped: HashMap<(String, String), Vec<&Asset>> = HashMap::new();
    for asset in assets {
        grouped
            .entry((asset.asset_type.clone(), asset.name.clone()))
            .or_default()
            .push(asset);
    }

    for ((asset_type, name), group) in grouped {
        if group.len() < 2 {
            continue;
        }

        let mut hashes = group
            .iter()
            .filter_map(|asset| asset.canonical_hash.clone())
            .collect::<Vec<_>>();
        hashes.sort();
        hashes.dedup();

        if hashes.len() < 2 {
            continue;
        }

        let Some(first) = group.first() else {
            continue;
        };
        let Some(primary_installation) = first.installations.first() else {
            continue;
        };

        findings.push(Finding {
            id: format!(
                "find-conflict-{}-{}",
                asset_type_slug(&asset_type),
                sha256_hex(format!("{asset_type}:{name}").as_bytes())[..12].to_string()
            ),
            asset_id: first.id.clone(),
            asset_name: name.clone(),
            platform_id: primary_installation.platform_id.clone(),
            platform_name: primary_installation.platform_name.clone(),
            issue: "Conflict".to_string(),
            risk_level: "high".to_string(),
            detail: format!("{asset_type} 存在同名不同内容冲突: {name}"),
        });
    }
}

fn scan_skill_files(
    _conn: &Connection,
    search_path: &Path,
    _pattern: &str,
    platform_id: &str,
    platform_name: &str,
    assets: &mut Vec<Asset>,
    _findings: &mut Vec<Finding>,
    content_hashes: &mut HashMap<String, Vec<String>>,
) -> Result<(), Box<dyn std::error::Error>> {
    for entry in WalkDir::new(search_path)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_dir() {
            let skill_file = path.join("SKILL.md");
            if skill_file.exists() && !fileops::is_sensitive_file(&skill_file.to_string_lossy()) {
                let content = fs::read(&skill_file)?;
                let hash = sha256_hex(&content);
                let now = chrono::Utc::now().to_rfc3339();
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let asset_id = format!("asset-{}", hash[..16].to_string());

                let mut metadata = parse_frontmatter(&String::from_utf8_lossy(&content));
                if metadata.name.is_empty() {
                    metadata.name = name.clone();
                }

                let installation = Installation {
                    id: format!("inst-{}", hash[..12].to_string()),
                    asset_id: asset_id.clone(),
                    platform_id: platform_id.to_string(),
                    platform_name: platform_name.to_string(),
                    path: skill_file.to_string_lossy().to_string(),
                    scope: derive_scope_and_project_local(&skill_file).0,
                    enabled: true,
                    official: metadata.source == "builtin" || metadata.source == "official",
                    project_local: derive_scope_and_project_local(&skill_file).1,
                    binding_type: "file".to_string(),
                    content_hash: Some(hash.clone()),
                    status: "enabled".to_string(),
                };

                if let Some(existing) = assets.iter_mut().find(|a| a.id == asset_id) {
                    existing.installations.push(installation);
                    existing.status = build_asset_status(&existing.installations);
                } else {
                    let status = build_asset_status(std::slice::from_ref(&installation));
                    assets.push(Asset {
                        id: asset_id.clone(),
                        asset_type: "Skill".to_string(),
                        name: metadata.name.clone(),
                        description: metadata.description,
                        author: metadata.author,
                        version: metadata.version,
                        source: metadata.source,
                        canonical_hash: Some(hash.clone()),
                        directory_hash: None,
                        risk_level: "low".to_string(),
                        status,
                        created_at: now.clone(),
                        updated_at: now,
                        installations: vec![installation],
                    });
                }

                content_hashes.entry(hash).or_default().push(asset_id);
            }

            let agents_file = path.join("AGENTS.md");
            if agents_file.exists() && !fileops::is_sensitive_file(&agents_file.to_string_lossy()) {
                let content = fs::read(&agents_file)?;
                let hash = sha256_hex(&content);
                let now = chrono::Utc::now().to_rfc3339();
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let asset_id = format!("asset-agent-{}", hash[..16].to_string());

                let installation = Installation {
                    id: format!("inst-agent-{}", hash[..12].to_string()),
                    asset_id: asset_id.clone(),
                    platform_id: platform_id.to_string(),
                    platform_name: platform_name.to_string(),
                    path: agents_file.to_string_lossy().to_string(),
                    scope: derive_scope_and_project_local(&agents_file).0,
                    enabled: true,
                    official: false,
                    project_local: derive_scope_and_project_local(&agents_file).1,
                    binding_type: "file".to_string(),
                    content_hash: Some(hash.clone()),
                    status: "enabled".to_string(),
                };

                if let Some(existing) = assets.iter_mut().find(|a| a.id == asset_id) {
                    existing.installations.push(installation);
                    existing.status = build_asset_status(&existing.installations);
                } else {
                    let status = build_asset_status(std::slice::from_ref(&installation));
                    assets.push(Asset {
                        id: asset_id.clone(),
                        asset_type: "Agent".to_string(),
                        name,
                        description: None,
                        author: None,
                        version: None,
                        source: "unknown".to_string(),
                        canonical_hash: Some(hash.clone()),
                        directory_hash: None,
                        risk_level: "low".to_string(),
                        status,
                        created_at: now.clone(),
                        updated_at: now,
                        installations: vec![installation],
                    });
                }
                content_hashes.entry(hash).or_default().push(asset_id);
            }
        }
    }
    Ok(())
}

fn scan_markdown_files(
    _conn: &Connection,
    search_path: &Path,
    asset_type: &str,
    platform_id: &str,
    platform_name: &str,
    assets: &mut Vec<Asset>,
    _findings: &mut Vec<Finding>,
    content_hashes: &mut HashMap<String, Vec<String>>,
) -> Result<(), Box<dyn std::error::Error>> {
    for entry in WalkDir::new(search_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file()
            && path.extension().map(|e| e == "md").unwrap_or(false)
            && !fileops::is_sensitive_file(&path.to_string_lossy())
        {
            let content = fs::read(path)?;
            let hash = sha256_hex(&content);
            let now = chrono::Utc::now().to_rfc3339();
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let resolved_asset_type = resolve_asset_type(search_path, path, asset_type);
            let asset_id = format!(
                "asset-{}-{}",
                asset_type_slug(&resolved_asset_type),
                hash[..16].to_string()
            );
            let (scope, project_local) = derive_scope_and_project_local(path);

            let installation = Installation {
                id: format!(
                    "inst-{}-{}",
                    asset_type_slug(&resolved_asset_type),
                    hash[..12].to_string()
                ),
                asset_id: asset_id.clone(),
                platform_id: platform_id.to_string(),
                platform_name: platform_name.to_string(),
                path: path.to_string_lossy().to_string(),
                scope,
                enabled: true,
                official: false,
                project_local,
                binding_type: "file".to_string(),
                content_hash: Some(hash.clone()),
                status: "enabled".to_string(),
            };

            if let Some(existing) = assets.iter_mut().find(|a| a.id == asset_id) {
                existing.installations.push(installation);
                existing.status = build_asset_status(&existing.installations);
            } else {
                let status = build_asset_status(std::slice::from_ref(&installation));
                assets.push(Asset {
                    id: asset_id.clone(),
                    asset_type: resolved_asset_type.clone(),
                    name,
                    description: None,
                    author: None,
                    version: None,
                    source: "unknown".to_string(),
                    canonical_hash: Some(hash.clone()),
                    directory_hash: None,
                    risk_level: asset_type_risk_level(&resolved_asset_type).to_string(),
                    status,
                    created_at: now.clone(),
                    updated_at: now,
                    installations: vec![installation],
                });
            }
            content_hashes.entry(hash).or_default().push(asset_id);
        }
    }
    Ok(())
}

fn scan_json_files(
    _conn: &Connection,
    search_path: &Path,
    asset_type: &str,
    platform_id: &str,
    platform_name: &str,
    assets: &mut Vec<Asset>,
    _findings: &mut Vec<Finding>,
    content_hashes: &mut HashMap<String, Vec<String>>,
) -> Result<(), Box<dyn std::error::Error>> {
    for entry in WalkDir::new(search_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file()
            && path.extension().map(|e| e == "json").unwrap_or(false)
            && !fileops::is_sensitive_file(&path.to_string_lossy())
        {
            let content = fs::read(path)?;
            let hash = sha256_hex(&content);
            let now = chrono::Utc::now().to_rfc3339();
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let resolved_asset_type = resolve_asset_type(search_path, path, asset_type);
            let asset_id = format!(
                "asset-{}-{}",
                asset_type_slug(&resolved_asset_type),
                hash[..16].to_string()
            );
            let (scope, project_local) = derive_scope_and_project_local(path);

            let installation = Installation {
                id: format!(
                    "inst-{}-{}",
                    asset_type_slug(&resolved_asset_type),
                    hash[..12].to_string()
                ),
                asset_id: asset_id.clone(),
                platform_id: platform_id.to_string(),
                platform_name: platform_name.to_string(),
                path: path.to_string_lossy().to_string(),
                scope,
                enabled: true,
                official: false,
                project_local,
                binding_type: "file".to_string(),
                content_hash: Some(hash.clone()),
                status: "enabled".to_string(),
            };

            if let Some(existing) = assets.iter_mut().find(|a| a.id == asset_id) {
                existing.installations.push(installation);
                existing.status = build_asset_status(&existing.installations);
            } else {
                let status = build_asset_status(std::slice::from_ref(&installation));
                assets.push(Asset {
                    id: asset_id.clone(),
                    asset_type: resolved_asset_type.clone(),
                    name,
                    description: None,
                    author: None,
                    version: None,
                    source: "unknown".to_string(),
                    canonical_hash: Some(hash.clone()),
                    directory_hash: None,
                    risk_level: asset_type_risk_level(&resolved_asset_type).to_string(),
                    status,
                    created_at: now.clone(),
                    updated_at: now,
                    installations: vec![installation],
                });
            }
            content_hashes.entry(hash).or_default().push(asset_id);
        }
    }
    Ok(())
}

fn asset_type_slug(asset_type: &str) -> &'static str {
    match asset_type {
        "Command" => "cmd",
        "Rule" => "rule",
        "Memory" => "memory",
        "Persona" => "persona",
        "MCP Server" => "mcp",
        _ => "asset",
    }
}

fn asset_type_risk_level(asset_type: &str) -> &'static str {
    match asset_type {
        "MCP Server" | "Rule" => "medium",
        _ => "low",
    }
}

fn parse_model_config(
    path: &Path,
    format: &str,
    platform_id: &str,
    platform_name: &str,
) -> Result<ModelBinding, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut provider = String::new();
    let mut model_id = String::new();
    let mut base_url = None;
    let mut key_present = false;
    let mut key_storage = "unknown".to_string();
    let mut warnings = String::new();

    match format {
        "json" => {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(parsed) = parse_json_model_schema(&json) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
                if json_contains_secret_key(&json) {
                    key_present = true;
                    key_storage = "config".to_string();
                    warnings = "API Key 存储在配置文件中".to_string();
                }
            }
        }
        "yaml" | "yml" => {
            if let Ok(yaml) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                if let Some(parsed) = parse_yaml_model_schema(&yaml) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
                if yaml_contains_secret_key(&yaml) {
                    key_present = true;
                    key_storage = "config".to_string();
                    warnings = "API Key 存储在配置文件中".to_string();
                }
            }
        }
        "toml" => {
            if let Ok(toml) = toml::from_str::<toml::Value>(&content) {
                if let Some(parsed) = parse_toml_model_schema(&toml) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
            }
        }
        _ => {}
    }

    // Check environment variables
    if !key_present {
        let env_vars = [
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "MOONSHOT_API_KEY",
            "OPENROUTER_API_KEY",
        ];
        for var in &env_vars {
            if std::env::var(var).is_ok() {
                key_present = true;
                key_storage = "env".to_string();
                break;
            }
        }
    }

    Ok(ModelBinding {
        id: format!(
            "mb-{}-{}",
            platform_id,
            sha256_hex(path.to_string_lossy().as_bytes())[..12].to_string()
        ),
        platform_id: platform_id.to_string(),
        platform_name: platform_name.to_string(),
        detected_provider: provider,
        detected_model_id: model_id,
        detected_base_url: base_url,
        config_path: path.to_string_lossy().to_string(),
        key_presence: key_present,
        key_storage,
        key_suffix: if key_present {
            Some("****".to_string())
        } else {
            None
        },
        validation_status: "not-checked".to_string(),
        last_validated_at: Some(now),
        warnings,
    })
}

struct ParsedModelSchema {
    provider: String,
    model_id: String,
    base_url: Option<String>,
}

fn parse_json_model_schema(value: &serde_json::Value) -> Option<ParsedModelSchema> {
    let provider = value
        .get("provider")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/model/provider").and_then(|v| v.as_str()))
        .or_else(|| value.pointer("/providers/default").and_then(|v| v.as_str()))
        .unwrap_or_default()
        .to_string();

    let provider_node = if provider.is_empty() {
        None
    } else {
        value.pointer(&format!("/providers/{provider}"))
    };

    let model_id = value
        .get("model")
        .and_then(|v| v.as_str())
        .or_else(|| value.get("model_id").and_then(|v| v.as_str()))
        .or_else(|| value.pointer("/model/id").and_then(|v| v.as_str()))
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("model"))
                .and_then(|v| v.as_str())
        })
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("model_id"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or_default()
        .to_string();

    let base_url = value
        .get("base_url")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/model/base_url").and_then(|v| v.as_str()))
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("base_url"))
                .and_then(|v| v.as_str())
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn parse_yaml_model_schema(value: &serde_yaml::Value) -> Option<ParsedModelSchema> {
    let root = value.as_mapping()?;
    let model = yaml_mapping_get(root, "model").and_then(|v| v.as_mapping());

    let provider = yaml_mapping_get(root, "provider")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "provider").and_then(|v| v.as_str()))
        })
        .unwrap_or_default()
        .to_string();

    let model_id = yaml_mapping_get(root, "model")
        .and_then(|v| v.as_str())
        .or_else(|| yaml_mapping_get(root, "model_id").and_then(|v| v.as_str()))
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "id").and_then(|v| v.as_str()))
        })
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "model").and_then(|v| v.as_str()))
        })
        .unwrap_or_default()
        .to_string();

    let base_url = yaml_mapping_get(root, "base_url")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "base_url").and_then(|v| v.as_str()))
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn parse_toml_model_schema(value: &toml::Value) -> Option<ParsedModelSchema> {
    let model = value.get("model");
    let provider = value
        .get("provider")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model
                .and_then(|v| v.get("provider"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or_default()
        .to_string();
    let model_id = value
        .get("model")
        .and_then(|v| v.as_str())
        .or_else(|| value.get("model_id").and_then(|v| v.as_str()))
        .or_else(|| model.and_then(|v| v.get("id")).and_then(|v| v.as_str()))
        .or_else(|| model.and_then(|v| v.get("model")).and_then(|v| v.as_str()))
        .unwrap_or_default()
        .to_string();
    let base_url = value
        .get("base_url")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model
                .and_then(|v| v.get("base_url"))
                .and_then(|v| v.as_str())
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn yaml_mapping_get<'a>(
    mapping: &'a serde_yaml::Mapping,
    key: &str,
) -> Option<&'a serde_yaml::Value> {
    mapping.get(serde_yaml::Value::String(key.to_string()))
}

fn json_contains_secret_key(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Object(map) => map
            .iter()
            .any(|(key, value)| is_secret_key_name(key) || json_contains_secret_key(value)),
        serde_json::Value::Array(items) => items.iter().any(json_contains_secret_key),
        _ => false,
    }
}

fn yaml_contains_secret_key(value: &serde_yaml::Value) -> bool {
    match value {
        serde_yaml::Value::Mapping(mapping) => mapping.iter().any(|(key, value)| {
            key.as_str().is_some_and(is_secret_key_name) || yaml_contains_secret_key(value)
        }),
        serde_yaml::Value::Sequence(items) => items.iter().any(yaml_contains_secret_key),
        _ => false,
    }
}

fn is_secret_key_name(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower == "api_key"
        || lower.ends_with("_api_key")
        || lower.contains("secret")
        || lower.contains("token")
        || lower.contains("credential")
}

struct ParsedFrontmatter {
    name: String,
    description: Option<String>,
    author: Option<String>,
    version: Option<String>,
    source: String,
}

fn parse_frontmatter(content: &str) -> ParsedFrontmatter {
    let mut result = ParsedFrontmatter {
        name: String::new(),
        description: None,
        author: None,
        version: None,
        source: "unknown".to_string(),
    };

    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let fm = &content[3..end + 3];
            let re_name = Regex::new(r"(?m)^name:\s*(.+)$").unwrap();
            let re_desc = Regex::new(r"(?m)^description:\s*(.+)$").unwrap();
            let re_author = Regex::new(r"(?m)^author:\s*(.+)$").unwrap();
            let re_version = Regex::new(r"(?m)^version:\s*(.+)$").unwrap();
            let re_source = Regex::new(r"(?m)^source:\s*(.+)$").unwrap();

            if let Some(cap) = re_name.captures(fm) {
                result.name = cap[1].trim().to_string();
            }
            if let Some(cap) = re_desc.captures(fm) {
                result.description = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_author.captures(fm) {
                result.author = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_version.captures(fm) {
                result.version = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_source.captures(fm) {
                result.source = cap[1].trim().to_string();
            }
        }
    }

    result
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    #[test]
    fn full_scan_persists_step_rows() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE scan_runs (
                id TEXT PRIMARY KEY,
                started_at TEXT,
                completed_at TEXT,
                status TEXT,
                platforms_found INTEGER,
                assets_found INTEGER,
                duplicates_found INTEGER,
                warnings_found INTEGER
            );
            CREATE TABLE scan_steps (
                id TEXT PRIMARY KEY,
                scan_run_id TEXT NOT NULL,
                step_key TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                detail TEXT,
                order_index INTEGER NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO scan_runs (id, started_at, completed_at, status, platforms_found, assets_found, duplicates_found, warnings_found)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                "scan-1",
                "2026-06-13T10:00:00Z",
                Option::<String>::None,
                "running",
                0,
                0,
                0,
                0,
            ],
        )
        .unwrap();

        let result = record_scan_step(
            &conn,
            "scan-1",
            "detect-platforms",
            "检测已安装平台",
            "扫描 PATH 和常见目录",
            "running",
            None,
            0,
        );

        assert!(result.is_ok());

        let stored: (String, String) = conn
            .query_row(
                "SELECT step_key, status FROM scan_steps WHERE scan_run_id = ?1",
                ["scan-1"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(stored.0, "detect-platforms");
        assert_eq!(stored.1, "running");
    }
}
