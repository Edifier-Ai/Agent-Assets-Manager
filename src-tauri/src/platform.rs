use crate::adapters::{self, PlatformAdapter};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PlatformKind {
    Codex,
    Claude,
    OpenCode,
    Hermes,
    OpenClaw,
    GenericCli,
}

impl PlatformKind {
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "codex" => Some(PlatformKind::Codex),
            "claude" => Some(PlatformKind::Claude),
            "opencode" => Some(PlatformKind::OpenCode),
            "hermes" => Some(PlatformKind::Hermes),
            "openclaw" => Some(PlatformKind::OpenClaw),
            "generic" => Some(PlatformKind::GenericCli),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            PlatformKind::Codex => "codex",
            PlatformKind::Claude => "claude",
            PlatformKind::OpenCode => "opencode",
            PlatformKind::Hermes => "hermes",
            PlatformKind::OpenClaw => "openclaw",
            PlatformKind::GenericCli => "generic",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            PlatformKind::Codex => "Codex",
            PlatformKind::Claude => "Claude Code",
            PlatformKind::OpenCode => "OpenCode",
            PlatformKind::Hermes => "Hermes",
            PlatformKind::OpenClaw => "OpenClaw",
            PlatformKind::GenericCli => "Generic CLI",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DetectedPlatform {
    pub id: String,
    pub kind: PlatformKind,
    pub cli_path: Option<String>,
    pub version: Option<String>,
    pub config_roots: Vec<String>,
    pub writable: String,
    pub detected_at: String,
    pub status: String,
    pub asset_count: i32,
    pub warning_count: i32,
    pub safe_actions: Vec<String>,
    pub preview_required_actions: Vec<String>,
}

pub fn detect_all_platforms() -> Vec<DetectedPlatform> {
    detect_platforms_with_adapters(adapters::all_adapters())
}

pub fn detect_platforms_with_adapters(
    adapter_list: Vec<Box<dyn PlatformAdapter>>,
) -> Vec<DetectedPlatform> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut results = Vec::new();

    for adapter in adapter_list {
        let kind = adapter.kind();
        let mut detected = false;
        let mut cli_path = None;
        let mut version = None;

        for bin_name in adapter.binary_names() {
            if let Ok(path) = which::which(bin_name) {
                detected = true;
                cli_path = Some(path.to_string_lossy().to_string());
                version = detect_version(bin_name, &path.to_string_lossy());
                break;
            }
        }

        let roots = adapter.config_roots();
        let has_config = roots.iter().any(|root| Path::new(root).exists());

        if detected || has_config {
            results.push(DetectedPlatform {
                id: kind.as_str().to_string(),
                kind,
                cli_path,
                version,
                config_roots: roots,
                writable: adapter.writable_status().to_string(),
                detected_at: now.clone(),
                status: if detected { "active" } else { "inactive" }.to_string(),
                asset_count: 0,
                warning_count: 0,
                safe_actions: adapter.safe_actions(),
                preview_required_actions: adapter.preview_required_actions(),
            });
        }
    }

    results
}

fn detect_version(bin_name: &str, _path: &str) -> Option<String> {
    use std::process::Command;
    let output = Command::new(bin_name).arg("--version").output();
    match output {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            let text = text.trim();
            if text.is_empty() {
                Some(String::from_utf8_lossy(&o.stderr).trim().to_string())
            } else {
                Some(text.to_string())
            }
        }
        _ => None,
    }
}

pub fn safe_actions_for_platform(kind: &PlatformKind) -> Vec<String> {
    adapters::adapter_for_kind(kind).safe_actions()
}

pub fn preview_required_actions_for_platform(kind: &PlatformKind) -> Vec<String> {
    adapters::adapter_for_kind(kind).preview_required_actions()
}
