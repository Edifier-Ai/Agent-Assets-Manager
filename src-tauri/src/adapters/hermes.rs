use super::{home_root, AssetSearchSpec, ModelConfigSpec, PlatformAdapter};
use crate::platform::PlatformKind;

#[derive(Default)]
pub struct HermesAdapter;

impl PlatformAdapter for HermesAdapter {
    fn kind(&self) -> PlatformKind {
        PlatformKind::Hermes
    }

    fn binary_names(&self) -> Vec<&'static str> {
        vec!["hermes"]
    }

    fn config_roots(&self) -> Vec<String> {
        vec![home_root(".hermes")]
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
            filename: "config.toml",
            format: "toml",
        }]
    }
}
