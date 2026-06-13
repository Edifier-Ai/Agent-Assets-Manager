crate::define_adapter!(
    CursorAdapter,
    kind: crate::platform::PlatformKind::Cursor,
    binaries: ["cursor"],
    config_roots: [".cursor"],
    writable: "partial",
    search_specs: [
        { subdir: "skills-cursor", pattern: "SKILL.md", asset_type: "Skill"   },
        { subdir: "rules",         pattern: ".md",       asset_type: "Rule"    },
        { subdir: "commands",      pattern: ".md",       asset_type: "Command" }
    ],
    model_configs: [
        { filename: "settings.json", format: "json" }
    ]
);
