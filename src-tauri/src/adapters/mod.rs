pub mod claude;
pub mod codex;
pub mod cursor;
pub mod gemini;
pub mod generic_cli;
pub mod hermes;
pub mod kimi;
pub mod openclaw;
pub mod opencode;
pub mod qwen;
pub mod trae;

use crate::platform::PlatformKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetSearchSpec {
    pub subdir: &'static str,
    pub pattern: &'static str,
    pub asset_type: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelConfigSpec {
    pub filename: &'static str,
    pub format: &'static str,
    pub writable_keys: &'static [&'static str],
    pub merge_strategy: &'static str,
}

pub const STANDARD_MODEL_WRITABLE_KEYS: &[&str] = &["provider", "model", "base_url"];
pub const ROOT_OBJECT_MERGE_STRATEGY: &str = "merge-root-object";

pub trait PlatformAdapter {
    fn kind(&self) -> PlatformKind;
    fn binary_names(&self) -> Vec<&'static str>;
    fn config_roots(&self) -> Vec<String>;
    fn writable_status(&self) -> &'static str;
    fn asset_search_specs(&self) -> Vec<AssetSearchSpec>;
    fn model_config_files(&self) -> Vec<ModelConfigSpec>;

    fn safe_actions(&self) -> Vec<String> {
        default_safe_actions()
    }

    fn preview_required_actions(&self) -> Vec<String> {
        default_preview_required_actions()
    }
}

pub fn all_adapters() -> Vec<Box<dyn PlatformAdapter>> {
    vec![
        Box::new(codex::CodexAdapter::default()),
        Box::new(claude::ClaudeAdapter::default()),
        Box::new(opencode::OpenCodeAdapter::default()),
        Box::new(hermes::HermesAdapter::default()),
        Box::new(openclaw::OpenClawAdapter::default()),
        Box::new(kimi::KimiAdapter::default()),
        Box::new(gemini::GeminiAdapter::default()),
        Box::new(qwen::QwenAdapter::default()),
        Box::new(cursor::CursorAdapter::default()),
        Box::new(trae::TraeAdapter::default()),
    ]
}

pub fn adapter_for_kind(kind: &PlatformKind) -> Box<dyn PlatformAdapter> {
    match kind {
        PlatformKind::Codex => Box::new(codex::CodexAdapter::default()),
        PlatformKind::Claude => Box::new(claude::ClaudeAdapter::default()),
        PlatformKind::OpenCode => Box::new(opencode::OpenCodeAdapter::default()),
        PlatformKind::Hermes => Box::new(hermes::HermesAdapter::default()),
        PlatformKind::OpenClaw => Box::new(openclaw::OpenClawAdapter::default()),
        PlatformKind::Kimi => Box::new(kimi::KimiAdapter::default()),
        PlatformKind::Gemini => Box::new(gemini::GeminiAdapter::default()),
        PlatformKind::Qwen => Box::new(qwen::QwenAdapter::default()),
        PlatformKind::Cursor => Box::new(cursor::CursorAdapter::default()),
        PlatformKind::Trae => Box::new(trae::TraeAdapter::default()),
        PlatformKind::GenericCli => Box::new(generic_cli::GenericCliAdapter::default()),
    }
}

/// Generates a standard PlatformAdapter implementation.
/// Supports multiple config roots (for platforms like Trae with several directories).
#[macro_export]
macro_rules! define_adapter {
    (
        $struct_name:ident,
        kind: $kind:expr,
        binaries: [$($bin:literal),* $(,)?],
        config_roots: [$($root:expr),* $(,)?],
        writable: $writable:literal,
        search_specs: [
            $( { subdir: $subdir:literal, pattern: $pattern:literal, asset_type: $atype:literal } ),* $(,)?
        ],
        model_configs: [
            $( { filename: $fname:literal, format: $fmt:literal } ),* $(,)?
        ]
    ) => {
        #[derive(Default)]
        pub struct $struct_name;

        impl $crate::adapters::PlatformAdapter for $struct_name {
            fn kind(&self) -> $crate::platform::PlatformKind {
                $kind
            }

            fn binary_names(&self) -> Vec<&'static str> {
                vec![$($bin),*]
            }

            fn config_roots(&self) -> Vec<String> {
                vec![$($crate::adapters::home_root($root)),*]
            }

            fn writable_status(&self) -> &'static str {
                $writable
            }

            fn asset_search_specs(&self) -> Vec<$crate::adapters::AssetSearchSpec> {
                vec![
                    $(
                        $crate::adapters::AssetSearchSpec {
                            subdir: $subdir,
                            pattern: $pattern,
                            asset_type: $atype,
                        }
                    ),*
                ]
            }

            fn model_config_files(&self) -> Vec<$crate::adapters::ModelConfigSpec> {
                vec![
                    $(
                        $crate::adapters::ModelConfigSpec {
                            filename: $fname,
                            format: $fmt,
                            writable_keys: $crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                            merge_strategy: $crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
                        }
                    ),*
                ]
            }
        }
    };
}

pub fn home_root(path: &str) -> String {
    dirs::home_dir()
        .unwrap_or_default()
        .join(path)
        .to_string_lossy()
        .to_string()
}

pub fn default_safe_actions() -> Vec<String> {
    vec![
        "读取文件".to_string(),
        "列出目录".to_string(),
        "搜索内容".to_string(),
        "查看配置".to_string(),
    ]
}

pub fn default_preview_required_actions() -> Vec<String> {
    vec![
        "写入文件".to_string(),
        "编辑配置".to_string(),
        "安装插件".to_string(),
        "修改设置".to_string(),
    ]
}
