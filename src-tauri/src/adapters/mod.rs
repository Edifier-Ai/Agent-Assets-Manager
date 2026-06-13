pub mod claude;
pub mod codex;
pub mod generic_cli;
pub mod hermes;
pub mod opencode;
pub mod openclaw;

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
}

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
        Box::new(generic_cli::GenericCliAdapter::default()),
    ]
}

pub fn adapter_for_kind(kind: &PlatformKind) -> Box<dyn PlatformAdapter> {
    match kind {
        PlatformKind::Codex => Box::new(codex::CodexAdapter::default()),
        PlatformKind::Claude => Box::new(claude::ClaudeAdapter::default()),
        PlatformKind::OpenCode => Box::new(opencode::OpenCodeAdapter::default()),
        PlatformKind::Hermes => Box::new(hermes::HermesAdapter::default()),
        PlatformKind::OpenClaw => Box::new(openclaw::OpenClawAdapter::default()),
        PlatformKind::GenericCli => Box::new(generic_cli::GenericCliAdapter::default()),
    }
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
