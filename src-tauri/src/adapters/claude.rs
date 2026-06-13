use super::{home_root, AssetSearchSpec, ModelConfigSpec, PlatformAdapter};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct ClaudeAdapter;

impl PlatformAdapter for ClaudeAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::Claude
    }

    fn binary_names(&self) -> Vec<&'static str> {
        vec!["claude"]
    }

    fn config_roots(&self) -> Vec<String> {
        vec![home_root(".claude")]
    }

    fn writable_status(&self) -> &'static str {
        "readonly"
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
        }]
    }
}
