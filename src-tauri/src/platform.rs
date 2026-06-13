use crate::adapters::{self, PlatformAdapter};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PlatformKind {
    Codex,
    Claude,
    OpenCode,
    Hermes,
    OpenClaw,
    Kimi,
    Gemini,
    Qwen,
    Cursor,
    Trae,
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
            "kimi" => Some(PlatformKind::Kimi),
            "gemini" => Some(PlatformKind::Gemini),
            "qwen" => Some(PlatformKind::Qwen),
            "cursor" => Some(PlatformKind::Cursor),
            "trae" => Some(PlatformKind::Trae),
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
            PlatformKind::Kimi => "kimi",
            PlatformKind::Gemini => "gemini",
            PlatformKind::Qwen => "qwen",
            PlatformKind::Cursor => "cursor",
            PlatformKind::Trae => "trae",
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
            PlatformKind::Kimi => "Kimi Code",
            PlatformKind::Gemini => "Gemini CLI",
            PlatformKind::Qwen => "Qwen Code",
            PlatformKind::Cursor => "Cursor",
            PlatformKind::Trae => "Trae",
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
            if let Some(path) = find_binary(bin_name) {
                detected = true;
                cli_path = Some(path.to_string_lossy().to_string());
                version = detect_version(&path.to_string_lossy());
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

fn find_binary(bin_name: &str) -> Option<std::path::PathBuf> {
    if let Ok(path) = which::which(bin_name) {
        return Some(path);
    }

    if let Some(path) = find_binary_in_common_dirs(bin_name) {
        return Some(path);
    }

    find_binary_via_login_shell(bin_name)
}

fn find_binary_in_common_dirs(bin_name: &str) -> Option<std::path::PathBuf> {
    let home = dirs::home_dir();
    let mut dirs = vec![
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
        "/usr/bin".into(),
        "/bin".into(),
    ];

    if let Some(home) = home {
        dirs.extend([
            home.join(".local/bin").to_string_lossy().to_string(),
            home.join(".cargo/bin").to_string_lossy().to_string(),
            home.join(".bun/bin").to_string_lossy().to_string(),
            home.join(".npm-global/bin").to_string_lossy().to_string(),
            home.join(".opencode/bin").to_string_lossy().to_string(),
            home.join(".kimi-code/bin").to_string_lossy().to_string(),
            home.join(".hermes/bin").to_string_lossy().to_string(),
        ]);
    }

    dirs.into_iter()
        .map(|dir| Path::new(&dir).join(bin_name))
        .find(|path| path.is_file())
}

fn find_binary_via_login_shell(bin_name: &str) -> Option<std::path::PathBuf> {
    let shell = std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "zsh".to_string());
    let output = command_output_with_timeout(
        &shell,
        &["-lc", &format!("command -v {}", shell_escape(bin_name))],
        Duration::from_millis(1200),
    )?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let path = text.lines().next()?.trim();
    if path.is_empty() {
        None
    } else {
        Some(std::path::PathBuf::from(path))
    }
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn detect_version(path: &str) -> Option<String> {
    let output = command_output_with_timeout(path, &["--version"], Duration::from_millis(1200))?;
    if !output.status.success() {
        return None;
    }
    let bytes = if output.stdout.is_empty() {
        output.stderr
    } else {
        output.stdout
    };
    let text = String::from_utf8_lossy(&bytes).trim().to_string();
    (!text.is_empty()).then_some(text)
}

fn command_output_with_timeout(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> Option<std::process::Output> {
    use std::io::Read;
    use std::process::{Command, Stdio};

    let mut child = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + timeout;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = Vec::new();
                let mut stderr = Vec::new();
                if let Some(mut stream) = child.stdout.take() {
                    let _ = stream.read_to_end(&mut stdout);
                }
                if let Some(mut stream) = child.stderr.take() {
                    let _ = stream.read_to_end(&mut stderr);
                }
                return Some(std::process::Output {
                    status,
                    stdout,
                    stderr,
                });
            }
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(25)),
            Err(_) => return None,
        }
    }
}

pub struct PlatformCache {
    pub inner: std::sync::Mutex<Option<(Instant, Vec<crate::db::Platform>)>>,
}

impl PlatformCache {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Mutex::new(None),
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = None;
        }
    }
}

pub const CACHE_TTL: Duration = Duration::from_secs(60);

pub fn safe_actions_for_platform(kind: &PlatformKind) -> Vec<String> {
    adapters::adapter_for_kind(kind).safe_actions()
}

pub fn preview_required_actions_for_platform(kind: &PlatformKind) -> Vec<String> {
    adapters::adapter_for_kind(kind).preview_required_actions()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::{AssetSearchSpec, ModelConfigSpec};
    use std::fs;

    struct TestAdapter {
        root: String,
        bin: &'static str,
    }

    impl PlatformAdapter for TestAdapter {
        fn kind(&self) -> PlatformKind {
            PlatformKind::Kimi
        }

        fn binary_names(&self) -> Vec<&'static str> {
            vec![self.bin]
        }

        fn config_roots(&self) -> Vec<String> {
            vec![self.root.clone()]
        }

        fn writable_status(&self) -> &'static str {
            "partial"
        }

        fn asset_search_specs(&self) -> Vec<AssetSearchSpec> {
            Vec::new()
        }

        fn model_config_files(&self) -> Vec<ModelConfigSpec> {
            Vec::new()
        }
    }

    #[test]
    fn detects_platform_when_only_config_root_exists() {
        let root = std::env::temp_dir().join(format!(
            "agent-assets-manager-platform-root-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        fs::create_dir_all(&root).unwrap();

        let platforms = detect_platforms_with_adapters(vec![Box::new(TestAdapter {
            root: root.to_string_lossy().to_string(),
            bin: "definitely-missing-agent-assets-manager-bin",
        })]);

        assert_eq!(platforms.len(), 1);
        assert_eq!(platforms[0].id, "kimi");
        assert_eq!(platforms[0].status, "inactive");

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn version_detection_times_out_for_non_returning_commands() {
        let root = std::env::temp_dir().join(format!(
            "agent-assets-manager-version-timeout-{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        fs::create_dir_all(&root).unwrap();
        let script = root.join("slow-version");
        fs::write(&script, "#!/bin/sh\nsleep 5\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&script).unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script, permissions).unwrap();
        }

        let started = Instant::now();
        let version = detect_version(&script.to_string_lossy());

        assert!(version.is_none());
        assert!(started.elapsed() < Duration::from_secs(3));

        fs::remove_dir_all(&root).unwrap();
    }
}
