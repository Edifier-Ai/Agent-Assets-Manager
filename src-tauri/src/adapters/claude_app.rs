crate::define_adapter!(
    ClaudeAppAdapter,
    kind: crate::platform::PlatformKind::ClaudeApp,
    binaries: [],
    config_roots: [
        "Library/Application Support/Claude",
        "Library/Application Support/Claude-3p"
    ],
    writable: "partial",
    search_specs: [
        { subdir: "configLibrary", pattern: ".json", asset_type: "Model Config" },
        { subdir: "plugins",       pattern: ".json", asset_type: "Tool"         },
        { subdir: "mcp",           pattern: ".json", asset_type: "MCP Server"   }
    ],
    model_configs: [
        { filename: "claude_desktop_config.json", format: "json" },
        { filename: "_meta.json",                 format: "json" }
    ]
);
