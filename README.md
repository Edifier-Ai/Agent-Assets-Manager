# Agent Assets Manager

Agent Assets Manager is a Mac-first local desktop control center for AI agent assets, platform installs, and model/provider configuration.

The app is built with Tauri 2, React, TypeScript, Rust, and SQLite. It scans local agent tool directories, normalizes discovered assets, shows platform/model state, and routes write-like actions through preview-first operation flows.

## Current Status

- Version: `0.1.3`
- Desktop target: macOS DMG
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Native core: Tauri 2 + Rust + SQLite
- UI language: Chinese for product UI, with product/platform/model names kept in English
- Default window: `1280x800`, minimum `1024x600`

Implemented areas:

- First-run scan wizard and scan page backed by Tauri commands
- SQLite-backed settings, scan runs, scan steps, operations, backups, model profiles, and model bindings
- DTO mapping layer between Rust snake_case payloads and frontend camelCase view models
- Overview, Assets, Platforms, Models, Scan, Backups, and Settings pages
- Asset filtering plus grouped card view by asset SKU/type
- Right-side detail panel for selected assets/platforms/model state
- Backend-generated operation previews for mutating actions
- Backup/trash-oriented safety model for local file changes
- Generated PNG platform icons and tracked macOS app bundle icons
- Non-wrapping Chinese labels and compact desktop-tool layout polish

## Supported Platform Surface

Default detection adapters currently cover:

- Codex
- Claude Code
- Claude App
- OpenCode
- Hermes
- OpenClaw
- Kimi Code
- Gemini CLI
- Qwen Code
- Cursor
- Trae

`Generic CLI` remains represented in the shared platform enum and adapter factory, but it is not included in the default `all_adapters()` detection registry yet.

Known config and binary discovery uses adapter-declared roots plus robust PATH fallback for common user shell locations such as `/opt/homebrew/bin`, `/usr/local/bin`, and `~/.local/bin`.

## Safety Rules

Agent Assets Manager treats local agent assets as potentially executable code.

- Secret values must not be stored in SQLite.
- API keys are displayed only as presence/masked status.
- State-changing actions must use preview before execution.
- Destructive or mutating operations create backups when supported.
- Deletes should move files into the app-managed trash area.
- Official or bundled assets should be protected from direct deletion.

## Development

Install dependencies:

```bash
npm install
```

Run the web shell:

```bash
npm run dev
```

This starts the browser shell only. It does not load real local business data, and unsupported runtime flows should stay blocked in this mode.

Run the Tauri desktop app:

```bash
npm run tauri dev
```

Use this path for real scans, settings persistence, previews, batch operations, and other business flows backed by the local Tauri runtime.

Run frontend tests:

```bash
npm test
```

Build frontend assets:

```bash
npm run build
```

Run Rust checks and tests:

```bash
cd src-tauri
cargo check
cargo test
```

Build the macOS DMG:

```bash
npm run tauri build
```

The final DMG is produced under:

```text
src-tauri/target/release/bundle/dmg/
```

## Project Layout

```text
src/
  api.ts                  Tauri-only command boundary for runtime business data
  mappers/                DTO-to-view-model mapping layer
  pages/                  Main Chinese UI pages
  components/             Shared app components, including PlatformIcon
  assets/platform-icons/  Generated PNG platform icons

src-tauri/
  src/adapters/           Platform-specific discovery and capability declarations
  src/scanner.rs          Scan orchestration and asset classification
  src/operations.rs       Preview-first local operation planning/execution
  src/db.rs               SQLite schema and persistence helpers
  src/commands.rs         Tauri command DTOs
  icons/                  macOS/Windows bundle icons

docs/
  assets/                 Product structure and UI reference images
  superpowers/specs/      Product and implementation specs
  superpowers/plans/      Gap-closure implementation plan and status
```

## Documentation

- Product/MVP design: `docs/superpowers/specs/2026-06-12-agent-assets-manager-mvp-design.md`
- Frontend and feature requirements: `docs/superpowers/specs/2026-06-12-agent-assets-manager-frontend-and-feature-requirements.md`
- Gap closure design: `docs/superpowers/specs/2026-06-13-full-gap-closure-design.md`
- Implementation plan/status: `docs/superpowers/plans/2026-06-13-full-gap-closure.md`
