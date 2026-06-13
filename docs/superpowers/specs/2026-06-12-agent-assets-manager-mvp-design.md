# Agent Assets Manager MVP Design

Date: 2026-06-12
Updated: 2026-06-13

## Current Implementation Snapshot

The repository has moved beyond the initial MVP specification. As of the current code state:

- The app version is `0.1.3`.
- The selected stack is implemented: Tauri 2, React 18, TypeScript, Vite, Rust, SQLite, and Tailwind CSS.
- The app has a real desktop shell, first-run wizard, scan page, persisted settings, persisted scan runs, operation previews, backup records, and model profile storage.
- The frontend has an explicit DTO mapping layer so Rust snake_case payloads are translated into camelCase UI view models.
- The Assets page now defaults to a grouped card view by asset type/SKU, with platform icons, add-to-all/per-platform install controls, Chinese actions, and a right-side detail panel.
- Generated PNG platform icons are tracked under `src/assets/platform-icons/`; bundle icons are tracked under `src-tauri/icons/`.
- Default platform detection adapters currently include Codex, Claude Code, OpenCode, Hermes, OpenClaw, Kimi Code, Gemini CLI, Qwen Code, Cursor, and Trae.
- `Generic CLI` exists in the platform enum and adapter factory but is not part of the default detection registry yet.

This document remains the product baseline. For exact implementation status, also read `docs/superpowers/plans/2026-06-13-full-gap-closure.md`.

## Product Positioning

Agent Assets Manager is a Mac-first local control center for AI agent assets and model configuration. The MVP focuses on accurate local discovery, safe governance, and unified model/provider visibility for tools such as Codex, Claude Code, OpenCode, Hermes, OpenClaw, and other CLI agents.

The first version is not a marketplace-first product. It should answer:

- What agent tools are installed on this Mac?
- What Skills, agents, commands, MCP servers, rules, memories, and provider configs do they use?
- Which assets are official, user-installed, project-local, duplicated, broken, or risky?
- Which models and providers are configured across tools?
- What can be safely enabled, disabled, backed up, restored, or removed?

## MVP Scope

### Included

- Mac desktop app.
- First-run scan wizard.
- Fast scan of known agent locations.
- Optional deep scan of user-selected folders.
- Local index backed by SQLite.
- Card-based Skills and agent asset management.
- Platform installation matrix for each asset.
- Safe enable, disable, restore, and delete-to-trash flows.
- Detection of Codex, Claude Code, OpenCode, Hermes, OpenClaw, Kimi Code, Gemini CLI, Qwen Code, Cursor, and Trae.
- Generic CLI representation through the shared platform model and adapter factory, with default detection still pending.
- Discovery of Skills, agents, commands, MCP configs, rules, memories, personas, and provider configs where supported.
- Unified model/provider management view.
- Operation preview before local writes.
- Backup and operation history.

### Excluded From MVP

- Public marketplace browsing.
- One-click install from remote registries.
- Git sync between machines.
- LLM-backed security review.
- Team collaboration.
- App Store distribution.
- Cloud account sync.

These are reserved for later versions after local discovery and governance are reliable.

## Recommended Technology Stack

- Desktop shell: Tauri 2.
- Frontend: React, TypeScript, Vite.
- UI: Tailwind CSS or a small local component system.
- Native core: Rust.
- Storage: SQLite.
- File operations: Rust filesystem layer.
- CLI detection: Rust process runner and PATH inspection.
- Packaging: Developer ID signed and notarized macOS app for external distribution; local unsigned builds are acceptable during MVP development.

This stack is preferred over pure SwiftUI for the MVP because Agent Assets Manager needs complex card grids, matrices, filtering, diff views, scan progress, and settings panels. Tauri keeps the app lightweight while giving Rust direct access to local scanning, hashing, and safe file operations.

## Core Concepts

### Platform

A supported agent or CLI surface.

Examples:

- Codex
- Claude Code
- OpenCode
- Hermes
- OpenClaw
- Kimi Code
- Gemini CLI
- Qwen Code
- Cursor
- Trae
- Generic CLI

Each platform has an adapter that knows where to find configs, how to parse assets, and which write operations are safe.

### Asset

A normalized item managed by Agent Assets Manager.

Asset types:

- Skill
- Agent
- Command
- MCP Server
- Tool
- Rule
- Memory
- Persona
- Provider Config
- Model Config
- CLI Runtime

The UI can emphasize Skills, but the internal model must be wider because OpenCode, Hermes, and OpenClaw expose more than `SKILL.md` files.

### Installation

The presence of an asset in a platform-specific location.

One asset may have many installations, for example the same Skill installed in Codex, Claude Code, and OpenCode.

### Binding

A platform-specific pointer from a platform to a canonical asset copy. Bindings may be implemented as symlinks, copied folders, or native config entries depending on platform support.

### Model Profile

A normalized provider/model configuration that Agent Assets Manager can display, validate, and optionally write back to platform configs.

Examples:

- Provider: OpenAI, Model: GPT-5.1 Codex, API base: default.
- Provider: Anthropic, Model: Claude Sonnet 4.6, API base: default.
- Provider: Kimi Anthropic-compatible, Model: kimi-for-coding, API base: custom.
- Provider: OpenRouter, Model: selected model id, API base: OpenRouter.
- Provider: Local/Ollama, Model: local model id, API base: localhost.

## First-Run Scan

The first launch opens a scan wizard instead of an empty dashboard.

### Step 1: Detect Installed Platforms

The scanner checks:

- Common binaries in PATH: `codex`, `claude`, `opencode`, `hermes`, `openclaw`, `kimi`, `gemini`, `qwen`, `cursor`, `trae`.
- Homebrew locations: `/opt/homebrew/bin`, `/usr/local/bin`.
- User binaries: `~/.local/bin`.
- Known config roots:
  - `~/.codex`
  - `~/.claude`
  - `~/.opencode`
  - `~/.config/opencode`
  - `~/.hermes`
  - `~/.openclaw`
  - `~/.kimi-code`
  - `~/.gemini`
  - `~/.qwen`
  - `~/.cursor`
  - `~/.trae`
- Optional project roots selected by the user.

### Step 2: Scan Known Asset Locations

The scanner searches known roots for:

- `SKILL.md`
- `AGENTS.md`
- command markdown files
- MCP config files
- model/provider config files
- Hermes/OpenClaw memory and persona files
- platform manifests or plugin metadata

The scanner must avoid broad hidden-directory traversal by default. Deep scan is opt-in.

### Step 3: Parse Metadata

For each found asset:

- Parse frontmatter when present.
- Extract title, description, author, version, license, source, and tags when available.
- Detect scripts, references, templates, assets, and config files.
- Infer metadata from file path and content when frontmatter is incomplete.

### Step 4: Fingerprint And Deduplicate

For each asset:

- Hash canonical content.
- Hash full directory content for folder-based Skills.
- Compare identical and near-identical assets across platforms.
- Mark duplicates, conflicts, and drift.

### Step 5: Classify Status

Each asset receives status labels:

- Installed
- Enabled
- Disabled
- Official or bundled
- User-installed
- Project-local
- Duplicate
- Conflict
- Broken
- Contains scripts
- Requires network
- Touches secrets or credentials
- Needs review

### Step 6: Persist Index

The scanner writes results to SQLite:

- scan runs
- platforms
- assets
- installations
- fingerprints
- findings
- operations
- backups

The dashboard reads from SQLite for fast startup. Users can rescan manually.

## Unified Model Management

The MVP adds a dedicated Models view.

### Goals

- Show which model/provider each supported agent is using.
- Surface conflicts and stale configuration.
- Let the user create reusable model profiles.
- Let the user apply a profile to one or more supported platforms.
- Prevent accidental secret leakage.

### Model Dashboard

The Models view shows:

- Platform
- Current provider
- Current model id
- API base URL
- Config source file
- Whether API key is present
- Whether API key is stored in env, keychain, or config file
- Last validation result
- Warnings for mismatched provider/model/base URL

API keys must never be shown in full. Agent Assets Manager should display only presence and a masked suffix when safe.

### Model Profiles

Users can create named profiles:

- `OpenAI Default`
- `Claude Default`
- `Kimi Coding`
- `OpenRouter Backup`
- `Local Ollama`

Each profile stores:

- provider type
- model id
- base URL
- environment variable names
- optional keychain reference
- notes

Secrets should be stored in macOS Keychain when Agent Assets Manager owns them. Existing secrets found in config files should be indexed but not copied into the database.

### Applying Profiles

Model configuration is read-first. The MVP must accurately detect and explain current model/provider state before it offers writes.

Applying a model profile is allowed only when the platform adapter declares the target keys and write strategy as supported. Every apply action should use an operation preview:

- Show which files will change.
- Show which environment variables or config keys will be written.
- Show whether the platform needs restart.
- Create backup before writing.

For unsupported or partially understood platforms, Agent Assets Manager should show read-only detection, warnings, and manual instructions until an adapter implements safe writes.

### Validation

Validation should be explicit, not automatic by default, because it may call remote providers.

Validation levels:

- Config parse check: no network.
- Provider endpoint check: network, no prompt.
- Minimal model call: network and token usage.

The MVP can implement parse check and optional endpoint check first. Minimal model calls can be added later.

## Safety Model

Agent Assets Manager is local-first and must treat agent assets as potentially executable code.

### Destructive Actions

No destructive action should happen without:

- dry-run preview
- backup
- operation log
- restore path
- confirmation for permanent delete

### Disable

Disable should remove the platform binding or move the platform copy into an Agent Assets Manager disabled area. It must not delete the canonical asset.

### Delete

Delete should move files into an app-managed trash under:

`~/Library/Application Support/Agent Assets Manager/Trash`

Permanent delete requires a second confirmation.

### Official/Bundled Assets

Official or bundled assets default to protected. The MVP may allow hiding or disabling bindings, but should avoid deleting bundled source files.

### Secrets

The scanner must not copy secret values into SQLite.

Secret-bearing files such as `.env`, private keys, certificates, token stores, and credential JSON files should be marked as sensitive and excluded from content previews.

## UI Design

### Main Navigation

- Overview
- Assets
- Platforms
- Models
- Scan
- Backups
- Settings

### Overview

Shows:

- Installed platforms
- Total assets
- Assets needing review
- Duplicate/conflict count
- Model config warnings
- Recent operations

### Assets

Card grid with filters:

- All
- Skills
- Agents
- Commands
- MCP
- Models
- Needs review
- Duplicates
- Conflicts
- Risky
- Project-local

Each card shows:

- name
- type
- description
- source platform
- install matrix
- status badges
- risk badges
- last modified time
- actions

### Platforms

Each platform page shows:

- detected CLI path
- version if available
- config roots
- supported asset types
- installed assets
- writable/read-only status
- model/provider config

### Models

Shows model profiles, platform bindings, validation status, and config conflicts.

### Scan

Shows:

- first-run scan progress
- manual rescan
- deep scan folder picker
- scan history
- warnings and skipped paths

## Adapter Responsibilities

Each adapter implements:

- detect platform availability
- locate config roots
- scan assets
- parse platform-specific metadata
- read model/provider config
- preview write operations
- apply safe changes
- restore backups

Current default adapters:

- CodexAdapter
- ClaudeAdapter
- OpenCodeAdapter
- HermesAdapter
- OpenClawAdapter
- KimiAdapter
- GeminiAdapter
- QwenAdapter
- CursorAdapter
- TraeAdapter

Factory-supported adapter:

- GenericCliAdapter

GenericCliAdapter detects CLI tools but starts read-only unless the user maps a custom asset root.

## Data Model Sketch

### platforms

- id
- name
- kind
- cli_path
- version
- config_roots
- writable
- detected_at

### assets

- id
- type
- name
- description
- author
- version
- source
- canonical_hash
- directory_hash
- risk_level
- created_at
- updated_at

### installations

- id
- asset_id
- platform_id
- path
- scope
- enabled
- official
- project_local
- binding_type
- content_hash
- status

### model_profiles

- id
- name
- provider
- model_id
- base_url
- key_storage
- env_key_names
- notes

### model_bindings

- id
- platform_id
- profile_id
- config_path
- detected_provider
- detected_model_id
- detected_base_url
- key_presence
- validation_status
- last_validated_at

### operations

- id
- operation_type
- target_type
- target_id
- preview_json
- result_json
- created_at
- completed_at

### backups

- id
- operation_id
- original_path
- backup_path
- hash
- created_at

## MVP Success Criteria

- First launch can scan the user's Mac and show installed agent platforms.
- Assets from Codex, Claude Code, OpenCode, Hermes, OpenClaw, Kimi Code, Gemini CLI, Qwen Code, Cursor, and Trae are listed where present.
- Duplicate and conflicting Skills can be identified by hash.
- The user can safely disable, restore, and trash user-installed assets.
- The Models page shows current provider/model configuration for supported platforms.
- Applying a model profile creates a backup and writes only through supported adapters.
- No secret value is stored in SQLite or rendered in full.
- All state-changing operations have previews and operation logs.

## Later Versions

- Remote marketplace discovery.
- GitHub and skills.sh install sources.
- Presets and bundles.
- Git backup and multi-machine sync.
- LLM-backed risk scanning.
- Skill quality scoring.
- Team policy profiles.
- Exportable agent environment report.
- One-click migration to a new Mac.
