crate::define_adapter!(
    KimiAdapter,
    kind: crate::platform::PlatformKind::Kimi,
    binaries: ["kimi"],
    config_roots: [".kimi-code"],
    writable: "partial",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md",  asset_type: "Skill"      },
        { subdir: "agents",   pattern: "AGENTS.md", asset_type: "Agent"      },
        { subdir: "commands", pattern: ".md",        asset_type: "Command"    },
        { subdir: "mcp",      pattern: ".json",      asset_type: "MCP Server" },
        { subdir: "rules",    pattern: ".md",        asset_type: "Rule"       },
        { subdir: "memories", pattern: ".md",        asset_type: "Memory"     },
        { subdir: "personas", pattern: ".md",        asset_type: "Persona"    }
    ],
    model_configs: [
        { filename: "config.toml", format: "toml" },
        { filename: "tui.toml",    format: "toml" }
    ]
);
