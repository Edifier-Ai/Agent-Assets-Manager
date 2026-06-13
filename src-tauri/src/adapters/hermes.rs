crate::define_adapter!(
    HermesAdapter,
    kind: crate::platform::PlatformKind::Hermes,
    binaries: ["hermes"],
    config_roots: [".hermes"],
    writable: "partial",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md", asset_type: "Skill"   },
        { subdir: "memories", pattern: ".md",       asset_type: "Memory"  },
        { subdir: "personas", pattern: ".md",       asset_type: "Persona" }
    ],
    model_configs: [
        { filename: "config.toml", format: "toml" }
    ]
);
