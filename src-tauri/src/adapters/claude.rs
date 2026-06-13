crate::define_adapter!(
    ClaudeAdapter,
    kind: crate::platform::PlatformKind::Claude,
    binaries: ["claude"],
    config_roots: [".claude"],
    writable: "readonly",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md",  asset_type: "Skill"   },
        { subdir: "agents",   pattern: "AGENTS.md", asset_type: "Agent"   },
        { subdir: "commands", pattern: ".md",        asset_type: "Command" }
    ],
    model_configs: [
        { filename: "config.json", format: "json" }
    ]
);
