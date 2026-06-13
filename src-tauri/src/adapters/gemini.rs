crate::define_adapter!(
    GeminiAdapter,
    kind: crate::platform::PlatformKind::Gemini,
    binaries: ["gemini"],
    config_roots: [".gemini", ".config/gemini"],
    writable: "partial",
    search_specs: [
        { subdir: "",         pattern: ".md",      asset_type: "Rule"    },
        { subdir: "skills",   pattern: "SKILL.md", asset_type: "Skill"   },
        { subdir: "commands", pattern: ".md",      asset_type: "Command" }
    ],
    model_configs: [
        { filename: "settings.json",       format: "json" },
        { filename: "config/config.json",  format: "json" }
    ]
);
