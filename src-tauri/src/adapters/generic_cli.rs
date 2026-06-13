use super::{AssetSearchSpec, ModelConfigSpec, PlatformAdapter};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct GenericCliAdapter {
    roots: Vec<String>,
}

impl GenericCliAdapter {
    pub fn with_roots(roots: Vec<String>) -> Self {
        Self { roots }
    }
}

impl PlatformAdapter for GenericCliAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::GenericCli
    }

    fn binary_names(&self) -> Vec<&'static str> {
        Vec::new()
    }

    fn config_roots(&self) -> Vec<String> {
        self.roots.clone()
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
        Vec::new()
    }
}
