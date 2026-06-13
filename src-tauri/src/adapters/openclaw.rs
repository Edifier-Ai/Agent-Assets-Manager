crate::define_adapter!(
    OpenClawAdapter,
    kind: crate::platform::PlatformKind::OpenClaw,
    binaries: ["openclaw"],
    config_roots: [".openclaw"],
    writable: "writable",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md", asset_type: "Skill"      },
        { subdir: "mcp",      pattern: ".json",     asset_type: "MCP Server" },
        { subdir: "rules",    pattern: ".md",       asset_type: "Rule"       },
        { subdir: "memories", pattern: ".md",       asset_type: "Memory"     },
        { subdir: "personas", pattern: ".md",       asset_type: "Persona"    }
    ],
    model_configs: [
        { filename: "config.json", format: "json" }
    ]
);
