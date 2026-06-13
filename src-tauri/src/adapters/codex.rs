crate::define_adapter!(
    CodexAdapter,
    kind: crate::platform::PlatformKind::Codex,
    binaries: ["codex"],
    config_roots: [".codex"],
    writable: "partial",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md",  asset_type: "Skill"   },
        { subdir: "agents",   pattern: "AGENTS.md", asset_type: "Agent"   },
        { subdir: "commands", pattern: ".md",        asset_type: "Command" }
    ],
    model_configs: [
        { filename: "config.json", format: "json" }
    ]
);
