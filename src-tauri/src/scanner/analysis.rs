use crate::db::{Asset, Finding, Installation};
use std::collections::HashMap;
use std::path::Path;

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

pub(crate) fn resolve_asset_type(search_path: &Path, file_path: &Path, fallback: &str) -> String {
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

pub(crate) fn derive_scope_and_project_local(path: &Path) -> (String, bool) {
    let path_str = path.to_string_lossy();
    let home = dirs::home_dir().map(|h| h.to_string_lossy().to_string());

    let is_in_home = home
        .as_ref()
        .is_some_and(|h| path_str.starts_with(h.as_str()));

    let is_hidden_config = path
        .components()
        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'));

    let project_indicators = [
        "Projects", "projects", "workspace", "workspaces", "repos",
        "code", "dev", "src", "workspace",
    ];
    let in_project_dir = path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        project_indicators.iter().any(|indicator| name == *indicator)
    });

    let project_local = in_project_dir && (!is_in_home || !is_hidden_config);
    let scope = if project_local { "project" } else { "global" };
    (scope.to_string(), project_local)
}

pub(crate) fn build_asset_status(installations: &[Installation]) -> String {
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

pub(crate) fn authoritative_source(metadata_source: &str, platform_name: &str) -> String {
    let trimmed = metadata_source.trim();
    if trimmed.is_empty() || trimmed == "unknown" {
        platform_name.to_string()
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn append_contextual_findings(findings: &mut Vec<Finding>, assets: &[Asset]) {
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

pub(crate) fn append_conflict_findings(findings: &mut Vec<Finding>, assets: &[Asset]) {
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
                super::asset_type_slug(&asset_type),
                super::sha256_hex(format!("{asset_type}:{name}").as_bytes())[..12].to_string()
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
