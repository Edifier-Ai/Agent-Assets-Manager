use crate::db::ModelBinding;
use regex::Regex;
use std::fs;
use std::path::Path;

pub(crate) struct ParsedModelSchema {
    pub provider: String,
    pub model_id: String,
    pub base_url: Option<String>,
}

pub(crate) struct ParsedFrontmatter {
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub source: String,
}

pub(crate) fn parse_model_config(
    path: &Path,
    format: &str,
    platform_id: &str,
    platform_name: &str,
) -> Result<ModelBinding, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut provider = String::new();
    let mut model_id = String::new();
    let mut base_url = None;
    let mut key_present = false;
    let mut key_storage = "unknown".to_string();
    let mut warnings = String::new();

    match format {
        "json" => {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(parsed) = parse_json_model_schema(&json) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
                if json_contains_secret_key(&json) {
                    key_present = true;
                    key_storage = "config".to_string();
                    warnings = "API Key 存储在配置文件中".to_string();
                }
            }
        }
        "yaml" | "yml" => {
            if let Ok(yaml) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                if let Some(parsed) = parse_yaml_model_schema(&yaml) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
                if yaml_contains_secret_key(&yaml) {
                    key_present = true;
                    key_storage = "config".to_string();
                    warnings = "API Key 存储在配置文件中".to_string();
                }
            }
        }
        "toml" => {
            if let Ok(toml) = toml::from_str::<toml::Value>(&content) {
                if let Some(parsed) = parse_toml_model_schema(&toml) {
                    provider = parsed.provider;
                    model_id = parsed.model_id;
                    base_url = parsed.base_url;
                }
            }
        }
        _ => {}
    }

    if !key_present {
        let env_vars = [
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "MOONSHOT_API_KEY",
            "OPENROUTER_API_KEY",
        ];
        for var in &env_vars {
            if std::env::var(var).is_ok() {
                key_present = true;
                key_storage = "env".to_string();
                break;
            }
        }
    }

    Ok(ModelBinding {
        id: format!(
            "mb-{}-{}",
            platform_id,
            super::sha256_hex(path.to_string_lossy().as_bytes())[..12].to_string()
        ),
        platform_id: platform_id.to_string(),
        platform_name: platform_name.to_string(),
        detected_provider: provider,
        detected_model_id: model_id,
        detected_base_url: base_url,
        config_path: path.to_string_lossy().to_string(),
        key_presence: key_present,
        key_storage,
        key_suffix: if key_present {
            Some("****".to_string())
        } else {
            None
        },
        validation_status: "not-checked".to_string(),
        last_validated_at: Some(now),
        warnings,
    })
}

pub(crate) fn parse_frontmatter(content: &str) -> ParsedFrontmatter {
    let mut result = ParsedFrontmatter {
        name: String::new(),
        description: None,
        author: None,
        version: None,
        source: "unknown".to_string(),
    };

    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let fm = &content[3..end + 3];
            let re_name = Regex::new(r"(?m)^name:\s*(.+)$").unwrap();
            let re_desc = Regex::new(r"(?m)^description:\s*(.+)$").unwrap();
            let re_author = Regex::new(r"(?m)^author:\s*(.+)$").unwrap();
            let re_version = Regex::new(r"(?m)^version:\s*(.+)$").unwrap();
            let re_source = Regex::new(r"(?m)^source:\s*(.+)$").unwrap();

            if let Some(cap) = re_name.captures(fm) {
                result.name = cap[1].trim().to_string();
            }
            if let Some(cap) = re_desc.captures(fm) {
                result.description = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_author.captures(fm) {
                result.author = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_version.captures(fm) {
                result.version = Some(cap[1].trim().to_string());
            }
            if let Some(cap) = re_source.captures(fm) {
                result.source = cap[1].trim().to_string();
            }
        }
    }

    result
}

fn parse_json_model_schema(value: &serde_json::Value) -> Option<ParsedModelSchema> {
    let provider = value
        .get("provider")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/model/provider").and_then(|v| v.as_str()))
        .or_else(|| value.pointer("/providers/default").and_then(|v| v.as_str()))
        .unwrap_or_default()
        .to_string();

    let provider_node = if provider.is_empty() {
        None
    } else {
        value.pointer(&format!("/providers/{provider}"))
    };

    let model_id = value
        .get("model")
        .and_then(|v| v.as_str())
        .or_else(|| value.get("model_id").and_then(|v| v.as_str()))
        .or_else(|| value.pointer("/model/id").and_then(|v| v.as_str()))
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("model"))
                .and_then(|v| v.as_str())
        })
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("model_id"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or_default()
        .to_string();

    let base_url = value
        .get("base_url")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/model/base_url").and_then(|v| v.as_str()))
        .or_else(|| {
            provider_node
                .and_then(|node| node.get("base_url"))
                .and_then(|v| v.as_str())
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn parse_yaml_model_schema(value: &serde_yaml::Value) -> Option<ParsedModelSchema> {
    let root = value.as_mapping()?;
    let model = yaml_mapping_get(root, "model").and_then(|v| v.as_mapping());

    let provider = yaml_mapping_get(root, "provider")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "provider").and_then(|v| v.as_str()))
        })
        .unwrap_or_default()
        .to_string();

    let model_id = yaml_mapping_get(root, "model")
        .and_then(|v| v.as_str())
        .or_else(|| yaml_mapping_get(root, "model_id").and_then(|v| v.as_str()))
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "id").and_then(|v| v.as_str()))
        })
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "model").and_then(|v| v.as_str()))
        })
        .unwrap_or_default()
        .to_string();

    let base_url = yaml_mapping_get(root, "base_url")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model.and_then(|mapping| yaml_mapping_get(mapping, "base_url").and_then(|v| v.as_str()))
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn parse_toml_model_schema(value: &toml::Value) -> Option<ParsedModelSchema> {
    let model = value.get("model");
    let provider = value
        .get("provider")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model
                .and_then(|v| v.get("provider"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or_default()
        .to_string();
    let model_id = value
        .get("model")
        .and_then(|v| v.as_str())
        .or_else(|| value.get("model_id").and_then(|v| v.as_str()))
        .or_else(|| model.and_then(|v| v.get("id")).and_then(|v| v.as_str()))
        .or_else(|| model.and_then(|v| v.get("model")).and_then(|v| v.as_str()))
        .unwrap_or_default()
        .to_string();
    let base_url = value
        .get("base_url")
        .and_then(|v| v.as_str())
        .or_else(|| {
            model
                .and_then(|v| v.get("base_url"))
                .and_then(|v| v.as_str())
        })
        .map(str::to_string);

    if provider.is_empty() && model_id.is_empty() && base_url.is_none() {
        None
    } else {
        Some(ParsedModelSchema {
            provider,
            model_id,
            base_url,
        })
    }
}

fn yaml_mapping_get<'a>(
    mapping: &'a serde_yaml::Mapping,
    key: &str,
) -> Option<&'a serde_yaml::Value> {
    mapping.get(serde_yaml::Value::String(key.to_string()))
}

fn json_contains_secret_key(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Object(map) => map
            .iter()
            .any(|(key, value)| is_secret_key_name(key) || json_contains_secret_key(value)),
        serde_json::Value::Array(items) => items.iter().any(json_contains_secret_key),
        _ => false,
    }
}

fn yaml_contains_secret_key(value: &serde_yaml::Value) -> bool {
    match value {
        serde_yaml::Value::Mapping(mapping) => mapping.iter().any(|(key, value)| {
            key.as_str().is_some_and(is_secret_key_name) || yaml_contains_secret_key(value)
        }),
        serde_yaml::Value::Sequence(items) => items.iter().any(yaml_contains_secret_key),
        _ => false,
    }
}

fn is_secret_key_name(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower == "api_key"
        || lower.ends_with("_api_key")
        || lower.contains("secret")
        || lower.contains("token")
        || lower.contains("credential")
}
