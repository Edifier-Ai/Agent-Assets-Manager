use super::{
    home_root, AssetSearchSpec, ModelConfigSpec, PlatformAdapter, ROOT_OBJECT_MERGE_STRATEGY,
    STANDARD_MODEL_WRITABLE_KEYS,
};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct CodexAdapter;

impl PlatformAdapter for CodexAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::Codex
    }

    fn binary_names(&self) -> Vec<&'static str> {
        vec!["codex"]
    }

    fn config_roots(&self) -> Vec<String> {
        vec![home_root(".codex")]
    }

    fn writable_status(&self) -> &'static str {
        "partial"
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
        ]
    }

    fn model_config_files(&self) -> Vec<ModelConfigSpec> {
        vec![ModelConfigSpec {
            filename: "config.json",
            format: "json",
            writable_keys: STANDARD_MODEL_WRITABLE_KEYS,
            merge_strategy: ROOT_OBJECT_MERGE_STRATEGY,
        }]
    }
}
