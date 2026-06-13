crate::define_adapter!(
    QwenAdapter,
    kind: crate::platform::PlatformKind::Qwen,
    binaries: ["qwen"],
    config_roots: [".qwen"],
    writable: "partial",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md", asset_type: "Skill"   },
        { subdir: "",         pattern: ".md",       asset_type: "Rule"    },
        { subdir: "commands", pattern: ".md",       asset_type: "Command" }
    ],
    model_configs: [
        { filename: "settings.json", format: "json" }
    ]
);
