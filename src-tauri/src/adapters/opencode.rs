use super::{
    home_root, AssetSearchSpec, ModelConfigSpec, PlatformAdapter, ROOT_OBJECT_MERGE_STRATEGY,
    STANDARD_MODEL_WRITABLE_KEYS,
};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct OpenCodeAdapter;

impl PlatformAdapter for OpenCodeAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::OpenCode
    }

    fn binary_names(&self) -> Vec<&'static str> {
        vec!["opencode"]
    }

    fn config_roots(&self) -> Vec<String> {
        vec![home_root(".opencode"), home_root(".config/opencode")]
    }

    fn writable_status(&self) -> &'static str {
        "writable"
    }

    fn asset_search_specs(&self) -> Vec<AssetSearchSpec> {
        vec![
            AssetSearchSpec {
                subdir: "skills",
                pattern: "SKILL.md",
                asset_type: "Skill",
            },
            AssetSearchSpec {
                subdir: "agents",
                pattern: "AGENTS.md",
                asset_type: "Agent",
            },
            AssetSearchSpec {
                subdir: "commands",
                pattern: ".md",
                asset_type: "Command",
            },
            AssetSearchSpec {
                subdir: "mcp",
                pattern: ".json",
                asset_type: "MCP Server",
            },
            AssetSearchSpec {
                subdir: "rules",
                pattern: ".md",
                asset_type: "Rule",
            },
            AssetSearchSpec {
                subdir: "memories",
                pattern: ".md",
                asset_type: "Memory",
            },
            AssetSearchSpec {
                subdir: "personas",
                pattern: ".md",
                asset_type: "Persona",
            },
        ]
    }

    fn model_config_files(&self) -> Vec<ModelConfigSpec> {
        vec![
            ModelConfigSpec {
                filename: "config.yaml",
                format: "yaml",
                writable_keys: STANDARD_MODEL_WRITABLE_KEYS,
                merge_strategy: ROOT_OBJECT_MERGE_STRATEGY,
            },
            ModelConfigSpec {
                filename: "config.yml",
                format: "yaml",
                writable_keys: STANDARD_MODEL_WRITABLE_KEYS,
                merge_strategy: ROOT_OBJECT_MERGE_STRATEGY,
            },
        ]
    }
}
