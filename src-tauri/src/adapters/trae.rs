crate::define_adapter!(
    TraeAdapter,
    kind: crate::platform::PlatformKind::Trae,
    binaries: ["trae", "trae-cn"],
    config_roots: [
        ".trae",
        ".trae-cn",
        "Library/Application Support/Trae",
        "Library/Application Support/Trae CN",
        "Library/Application Support/TRAE SOLO"
    ],
    writable: "partial",
    search_specs: [
        { subdir: "skills",         pattern: "SKILL.md", asset_type: "Skill"      },
        { subdir: "builtin_skills", pattern: "SKILL.md", asset_type: "Skill"      },
        { subdir: "commands",       pattern: ".md",       asset_type: "Command"    },
        { subdir: "rules",          pattern: ".md",       asset_type: "Rule"       },
        { subdir: "memory",         pattern: ".md",       asset_type: "Memory"     },
        { subdir: "mcps",           pattern: ".json",     asset_type: "MCP Server" }
    ],
    model_configs: [
        { filename: "memory-config.json", format: "json" },
        { filename: "skill-config.json",  format: "json" }
    ]
);
