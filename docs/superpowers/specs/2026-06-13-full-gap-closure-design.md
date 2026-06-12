# Agent Assets Manager Full Gap Closure Design

Date: 2026-06-13

## Goal

This design closes the implementation gaps identified between the MVP specification and the current repository state.

The outcome is not a greenfield rewrite. It is a staged completion plan that keeps the current Tauri + React + Rust + SQLite architecture, removes prototype-only behavior, and delivers a real end-to-end local desktop application with:

- real scan flows instead of timer-based demos
- stable frontend/backend contracts
- adapter-driven platform scanning and write capability declarations
- persistent settings and operation history
- safer asset operations with preview and logging
- model profile management with read-first write controls

## Scope

### In Scope

- Replace mock-driven scan UX with real backend-driven flows.
- Unify frontend and backend data contracts.
- Add missing persistence for settings, operation previews, operation logs, and model profiles.
- Introduce adapter modules for supported platforms.
- Expand asset classification beyond the current coarse markdown and JSON scan.
- Add backend operation preview support for destructive or state-changing actions.
- Implement model profile storage and apply flows for explicitly supported adapters.
- Preserve Chinese UI copy expectations already defined in the frontend requirements.

### Out of Scope

- Public marketplace browsing.
- Remote registry installation.
- Cloud sync or Git sync.
- Team collaboration workflows.
- LLM-driven security analysis.
- Full plugin ecosystem redesign.

## Current Problems

The existing repository already has a strong base, but several gaps prevent it from satisfying the MVP specification:

- The first-run wizard and scan page simulate progress with timers instead of reflecting backend state.
- Frontend types are camelCase while Rust payloads are snake_case, with no explicit translation layer.
- Platform behavior is largely hard-coded in `PlatformKind` and `scanner.rs` instead of adapter modules.
- The scan pipeline identifies only a subset of asset categories and over-classifies markdown files as commands.
- Operation previews are mostly UI placeholders rather than backend-generated plans.
- Settings are not persisted.
- Model profiles are mocked in the frontend and not stored in SQLite.
- Generic CLI is defined but not actually surfaced as a detected platform.

## Design Principles

- Keep the app runnable after every implementation phase.
- Prefer additive migration over disruptive rewrites.
- Make write operations adapter-declared and preview-first.
- Keep secrets out of SQLite and UI payloads.
- Make the backend the source of truth for scans, previews, backups, and persisted state.
- Keep the frontend focused on presentation, input gathering, and optimistic but reversible UX.

## Target Architecture

### Frontend

The frontend remains a React + TypeScript single-window desktop UI, but it gains a strict mapping layer between Tauri responses and UI view models.

Frontend responsibilities:

- request data from Tauri commands
- translate raw backend payloads into UI-friendly shapes
- render scan progress, history, asset lists, platform details, settings, and previews
- collect user intent for scans, settings saves, profile applies, disable/delete/restore actions
- never compute authoritative scan results or operation previews locally

### Backend

The backend remains Rust + SQLite, but the internal structure becomes more explicit:

- `adapters/` handles platform-specific discovery, parsing, model config support, and write capabilities
- `scanner.rs` becomes orchestration rather than platform rule storage
- `operations.rs` generates preview plans and executes approved operations
- `db.rs` owns schema migrations and persistence methods
- `commands.rs` exposes stable Tauri commands using API-oriented request and response types

### Storage

SQLite remains the local index and operations log.

New or expanded persisted areas:

- `app_settings`
- `scan_runs`
- `scan_steps`
- `operations`
- `operation_previews`
- `model_profiles`
- `model_profile_targets`

Backups and disabled assets continue to live in app-managed filesystem directories under the application support root.

## Implementation Strategy

The work is intentionally split into six phases. Each phase ends in a verifiable, working state.

### Phase 1: Contract And Persistence Foundation

This phase stabilizes data flow before feature expansion.

Deliverables:

- Add a frontend mapping layer from backend DTOs to UI models.
- Standardize all Tauri command responses around explicit request and response types.
- Persist settings in SQLite instead of returning hard-coded defaults.
- Add new schema tables for operations and model profiles.
- Add lightweight migration logic for existing installations.

Decisions:

- The frontend keeps camelCase view models.
- Rust keeps snake_case serialization.
- `src/api.ts` stops returning raw backend structs directly; it maps them through dedicated translator functions.
- Existing UI components continue to consume camelCase types, minimizing churn in presentation code.

Success criteria:

- No page relies on accidental JSON field compatibility.
- Settings survive app restart.
- New schema tables exist and can be queried without breaking current pages.

### Phase 2: Real Scan Flow

This phase removes demo scanning behavior and makes scan UX backend-driven.

Deliverables:

- Replace timer-based first-run wizard progress with real scan execution.
- Replace timer-based scan page progress with backend-driven step states.
- Persist scan history from real scan runs.
- Add scan request options for known roots, deep scan folders, and include-project-local behavior.
- Surface Generic CLI as a read-only platform when mapped roots or detected binaries exist.

Decisions:

- Backend scan commands return a run identifier plus current or completed aggregate result.
- Step-level progress is persisted in SQLite so the UI can reload scan history without synthetic state.
- Deep scan remains opt-in and limited to user-selected directories.

Success criteria:

- The first-run wizard displays real scan progress and real counts.
- The scan page history table reads from `scan_runs` and related step data.
- A user-triggered rescan updates the overview, assets, and model pages without mock data.

### Phase 3: Adapter Extraction And Asset Classification

This phase aligns scanning and capability behavior with the MVP spec.

Deliverables:

- Create adapter modules for Codex, Claude Code, OpenCode, Hermes, OpenClaw, and Generic CLI.
- Move search roots, search patterns, model config locations, writable declarations, and safe write support into adapters.
- Expand classification to distinguish:
  - Skill
  - Agent
  - Command
  - MCP Server
  - Rule
  - Memory
  - Persona
  - Provider Config
  - Model Config
  - CLI Runtime
- Improve metadata parsing for frontmatter and path-derived inference.

Decisions:

- An adapter trait defines detection, scan roots, asset discovery, model config discovery, preview support, and apply support.
- `GenericCliAdapter` starts as read-only and only exposes richer scan behavior when a custom root is configured.
- Markdown files are classified by directory context and adapter rules, not only by file extension.

Success criteria:

- Asset lists reflect the richer types from the spec.
- Platform pages show capabilities coming from adapter declarations.
- Scanner orchestration does not directly hard-code per-platform search behavior.

### Phase 4: Safe Operation Preview And Execution

This phase makes state-changing actions match the safety model in the MVP spec.

Deliverables:

- Add backend-generated preview plans for disable, delete-to-trash, restore, and supported model profile apply actions.
- Store operation logs in SQLite.
- Enforce backup-before-write for destructive or mutating operations.
- Add protection rules for official or bundled assets.
- Add restore path and backup references to operation results.

Preview payload fields:

- operation type
- target id and target path
- files to modify
- files to move
- backup paths to create
- environment keys to write or update
- whether restart is needed
- warnings and unsupported reasons

Decisions:

- The frontend never invents previews.
- The preview modal becomes a renderer for backend previews.
- Unsupported operations return a structured preview with `supported = false` and human-readable reasons.

Success criteria:

- Disable and delete actions always show a real preview before execution.
- Operations are logged and restorable when applicable.
- Official or bundled assets cannot be permanently removed through normal flows.

### Phase 5: Model Management Completion

This phase closes the gap between read-only model detection and the MVP model management view.

Deliverables:

- Persist model profiles in SQLite.
- Replace frontend mock model profiles with real database-backed profiles.
- Add apply-profile flows for adapters that explicitly declare supported target keys and write strategy.
- Add validation levels:
  - parse check
  - endpoint check
- Continue to avoid full model invocation by default.

Decisions:

- Secrets remain outside SQLite.
- Profiles may store environment variable names, base URL, provider, model id, notes, and key storage strategy metadata.
- Applying a profile is only supported when an adapter declares:
  - writable fields
  - target config path or env strategy
  - backup support
  - preview support

Success criteria:

- The models page uses persisted profile data.
- Applying a profile is impossible on unsupported adapters and explicit on supported ones.
- Warnings clearly explain config mismatch or insecure key storage in config files.

### Phase 6: Validation, Cleanup, And Readiness

This phase ensures the completed work is shippable as an MVP-grade implementation.

Deliverables:

- Remove remaining mock data dependencies from runtime paths.
- Run and fix `tsc`, `vite build`, and `cargo check`.
- Add targeted tests for mapping logic, settings persistence, preview generation, and scan classification helpers.
- Audit Chinese UI copy for newly added surfaces.

Success criteria:

- Main flows work without demo fallbacks.
- No page depends on static seed objects for current-state rendering.
- The repository builds cleanly for frontend and backend.

## Detailed Component Changes

### Frontend API Layer

Add explicit mapping helpers in the frontend:

- `mapPlatformDto`
- `mapAssetDto`
- `mapModelBindingDto`
- `mapBackupDto`
- `mapFindingDto`
- `mapScanRunDto`
- `mapSettingsDto`
- `mapOperationPreviewDto`
- `mapModelProfileDto`

These functions become the compatibility boundary between Rust payloads and React pages.

### App Shell

`App.tsx` remains the orchestration root, but it should:

- load settings alongside existing data
- treat first run as "no completed real scan exists" instead of just empty arrays
- use real scan completion to exit the first-run wizard
- refresh all state after mutating operations

### First-Run Wizard

The wizard becomes a real onboarding flow:

- step 1: welcome
- step 2: permissions and scan scope explanation
- step 3: actual scan execution and live step state
- completion state uses backend results

The wizard does not fabricate counts.

### Scan Page

The scan page should:

- start real scans
- show the current in-progress run if one exists
- read history from persisted scan runs
- allow choosing deep scan folders
- explain skipped paths and sensitive file handling from backend policy text

### Settings Page

The settings page should:

- load persisted values from backend
- save theme, include-project-local, deep scan, and custom scan roots
- optionally expose reset-to-defaults
- show actual DB and trash locations returned from backend

### Models Page

The models page should:

- render real model bindings
- render real model profiles from SQLite
- offer profile apply only where adapter support exists
- show validation actions and statuses

### Assets And Platforms Pages

These pages need minimal layout changes but stronger data semantics:

- richer asset types and statuses
- official and protected labels
- capability-driven action availability
- preview-first operations

## Backend Module Design

### Adapter Trait

Each adapter implements a shared interface conceptually equivalent to:

- detect availability
- provide config roots
- discover assets
- discover model config
- declare writable level
- declare supported operations
- generate preview for supported operations
- apply supported operations

The exact Rust trait can be refined during implementation, but the interface must keep scanner orchestration free of per-platform branching where possible.

### Scanner

`scanner.rs` becomes responsible for:

- coordinating adapters
- creating scan runs and scan steps
- invoking asset discovery
- invoking model config discovery
- deduplicating and generating findings
- persisting scan results

It should not remain the place where platform rules are authored.

### Operations

Add a dedicated module for preview and execution:

- `preview_disable`
- `preview_delete_to_trash`
- `preview_restore`
- `preview_apply_model_profile`
- matching execution functions

This module owns backup requirements, official asset protection, and operation log persistence.

### Database

Add migration-safe schema evolution.

Required tables:

- `operations`
- `model_profiles`
- `scan_steps`

Potential helper tables:

- `operation_targets`
- `model_profile_targets`

If helper tables are unnecessary, equivalent JSON columns are acceptable for the MVP as long as the schema stays queryable and maintainable.

## Data Model Changes

### New Tables

`operations`

- id
- operation_type
- status
- target_type
- target_id
- target_path
- preview_json
- result_json
- backup_id
- created_at
- completed_at

`model_profiles`

- id
- name
- provider
- model_id
- base_url
- key_storage
- env_key_names
- notes
- created_at
- updated_at

`scan_steps`

- id
- scan_run_id
- step_key
- title
- description
- status
- detail
- order_index
- started_at
- completed_at

### Existing Table Adjustments

`app_settings`

- store structured keys for:
  - custom scan roots
  - include project local
  - deep scan enabled
  - theme
  - security level

`assets`

- keep canonical hash and optional directory hash
- persist richer asset type values

`findings`

- support duplicate, conflict, project-local, broken, risky-config, insecure-secret-storage, unsupported-write

## Error Handling

All Tauri commands should return structured errors with user-displayable messages.

Rules:

- Unsupported operations are not generic failures; they return supported=false previews or domain-specific errors.
- Parse failures should still preserve partial scan success when possible.
- Deep scan errors for one folder should not invalidate the whole scan run.
- The frontend should show actionable toasts and inline error states, not raw stack traces.

## Testing Strategy

Testing should be focused rather than exhaustive.

### Frontend

- unit tests for DTO-to-view-model mapping
- tests for scan-state rendering logic if lightweight
- tests for settings form serialization if helpful

### Backend

- tests for settings persistence
- tests for preview generation rules
- tests for asset classification helpers
- tests for deduplication and findings generation

### Manual Validation

- first launch with empty DB
- scan on a machine with some supported config roots
- disable asset with preview
- delete asset to trash with preview
- restore from backup
- create and apply a supported model profile
- restart app and verify persisted settings and history

## Risks And Mitigations

- Large refactor risk: mitigate by phasing the work and preserving old UI layout while changing data sources.
- DTO mismatch risk: mitigate by introducing explicit mappers early in phase 1.
- Adapter complexity risk: keep a minimal trait and move only platform-specific logic behind it.
- Filesystem safety risk: no direct mutation without preview and backup.
- Scope creep risk: keep out-of-scope items explicitly excluded.

## Acceptance Criteria

The implementation is complete when all of the following are true:

- No primary runtime flow depends on timer-based mock scan behavior.
- Settings are persisted and restored.
- Scan runs and scan history are real.
- Generic CLI is represented according to configured or detectable roots.
- Assets are classified using adapter-aware logic rather than only by file extension.
- Operation previews come from the backend and execute with backup and logging.
- Model profiles are persisted and usable for supported adapters.
- Frontend/backend field naming mismatches are resolved through explicit mapping.
- The app builds successfully with `vite build` and `cargo check`.

## Recommended Execution Order

1. Phase 1 contract and persistence foundation
2. Phase 2 real scan flow
3. Phase 3 adapter extraction and asset classification
4. Phase 4 safe operation preview and execution
5. Phase 5 model management completion
6. Phase 6 validation, cleanup, and readiness

This order minimizes churn because UI surfaces begin consuming stable contracts before deeper backend features are added.
