use super::{home_root, AssetSearchSpec, ModelConfigSpec, PlatformAdapter};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct OpenClawAdapter;

impl PlatformAdapter for OpenClawAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::OpenClaw
    }

    fn binary_names(&self) -> Vec<&'static str> {
        vec!["openclaw"]
    }

    fn config_roots(&self) -> Vec<String> {
        vec![home_root(".openclaw")]
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
        vec![ModelConfigSpec {
            filename: "config.json",
            format: "json",
        }]
    }
}
