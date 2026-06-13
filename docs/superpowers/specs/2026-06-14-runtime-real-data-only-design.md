# Agent Assets Manager Runtime Real Data Only Design

Date: 2026-06-14

## Current Implementation Snapshot

The repository has already completed the core transition from prototype flows to a real Tauri + Rust + SQLite desktop application, but one prototype-era behavior remains in live runtime code: browser-only fallback data.

Current live-code facts relevant to this design:

- `src/api.ts` still returns fallback platforms, assets, findings, scan runs, settings, and operation previews when the app is not running inside Tauri.
- `src/data/mockData.ts` still acts as a runtime data source for browser mode.
- `src/App.tsx` surfaces a browser demo banner and renders the app using fallback data instead of blocking unsupported runtime entry.
- The Tauri desktop path already has real backend commands for scans, settings, operation previews, batch sync previews, and persisted state.
- The team decision for this design is explicit: all business data must come from real local state, and browser mode must no longer impersonate a usable product experience.

## Goal

Remove all runtime mock, fallback, and stubbed business data from the application so that every business-facing view and action is backed by real Tauri desktop capabilities only.

The result should make the runtime boundary unambiguous:

- Tauri desktop runtime: supported, real data only
- Plain browser runtime: unsupported for business data, with a clear blocking message

## Scope

### In Scope

- Remove runtime fallback returns from `src/api.ts`.
- Stop importing `src/data/mockData.ts` from runtime application code.
- Replace browser demo mode with a blocking unsupported-runtime state.
- Ensure settings, scans, assets, findings, previews, and sync plans all require Tauri.
- Update tests so non-Tauri behavior fails explicitly instead of returning fake data.
- Update documentation to reflect the new runtime contract.

### Out of Scope

- Adding a browser-to-local bridge so web mode can access real machine data.
- Replacing Tauri with another desktop runtime.
- Redesigning backend scan, settings, or operation logic that is already real.
- Expanding platform support beyond the current adapter surface.

## Problem Statement

The app currently mixes two runtime behaviors:

- the real desktop path backed by Rust, SQLite, and local filesystem discovery
- the browser path backed by hard-coded fallback objects and stubbed responses

This causes three problems:

1. It weakens the product contract. A user can see believable but fake assets, scan history, settings, and previews.
2. It hides integration issues. Browser mode can appear healthy even when the real desktop integration is broken.
3. It creates maintenance drift. New features may accidentally add more browser-only fake branches instead of preserving a single source of truth.

## Design Principles

- Real data only for every business-facing state.
- One authoritative runtime boundary: Tauri desktop.
- Fail loudly instead of faking success outside supported runtime.
- Keep the unsupported browser shell useful for static UI work, but never for business data validation.
- Prevent future regressions with explicit tests for unsupported runtime behavior.

## Target Behavior

### Supported Runtime

When the app runs inside Tauri:

- `src/api.ts` calls Tauri commands only.
- Pages render persisted or freshly scanned local state.
- Operation previews and execution plans come from the backend.
- Settings are loaded from and saved to real storage.
- First-run and rescan behaviors depend only on real scan history.

### Unsupported Runtime

When the app runs outside Tauri:

- No runtime API returns fallback business data.
- Data access methods fail with a clear and consistent unsupported-runtime error.
- The main app shell does not render a believable data-bearing product state.
- The UI shows a blocking message that tells the user to run `npm run tauri dev` or open the desktop app.

## Architecture Changes

### Frontend API Boundary

`src/api.ts` becomes a strict Tauri-only boundary for business data.

Design decisions:

- Remove imports of runtime fallback collections from `src/data/mockData.ts`.
- Replace every `if (!isTauriRuntime()) { return ... }` branch with a shared unsupported-runtime error path.
- Keep `isTauriRuntime()` as the only runtime detector.
- Remove `isDevelopmentFallbackMode()` because browser fallback mode no longer exists as a product behavior.

Recommended helper shape:

- a small internal guard such as `ensureTauriRuntime()` that throws a consistent error before calling any business command
- used by all read and write methods in `src/api.ts`

This keeps the failure mode uniform and prevents future branches from reintroducing browser-only fake data.

### App Entry Experience

`src/App.tsx` stops treating browser mode as a valid demo state.

Design decisions:

- Detect non-Tauri runtime before attempting full business-data bootstrapping.
- Render a blocking unsupported-runtime panel instead of the current fallback-data banner.
- The blocking state should explain that business data is available only in the Tauri desktop app.
- The blocking state should include a short developer-facing action hint: use `npm run tauri dev`.

The shell can still render enough layout to keep visual development possible, but it must not imply that the current assets, scans, settings, or warnings are real.

### Mock Data File

`src/data/mockData.ts` must no longer participate in runtime application behavior.

Preferred decision:

- remove the file entirely if no tests or design references need it

Allowed alternative:

- keep it temporarily for isolated test fixtures only, but do not import it from production runtime code

The implementation should prefer deletion if the repository no longer needs the file after test updates.

## Data Flow

### Tauri Runtime

1. App boots.
2. Runtime check confirms Tauri.
3. UI loads platforms, assets, model bindings, findings, scan runs, settings, and logs through `src/api.ts`.
4. `src/api.ts` invokes Rust commands and maps DTOs through `src/mappers/`.
5. Pages render only backend-backed state.

### Non-Tauri Runtime

1. App boots.
2. Runtime check fails.
3. App shows unsupported-runtime UI.
4. No business dataset is synthesized locally.
5. If any business API is called directly in tests or future code, it throws the same unsupported-runtime error.

## Error Handling

All non-Tauri business API access should fail with a consistent error message, for example:

`Real business data is available only in the Tauri desktop app.`

Requirements:

- The message must be stable enough for tests.
- The message must be understandable to both developers and product reviewers.
- Write-like APIs and read APIs should use the same runtime support rule.
- The UI blocking state can use friendlier Chinese product copy, but the thrown error should remain consistent in code.

## UI Requirements

The unsupported-runtime state in `src/App.tsx` should:

- clearly state that the current browser shell cannot read real local assets
- state that fallback/demo data has been removed
- avoid rendering fake scan timestamps, fake counts, or fake settings state
- guide the developer to `npm run tauri dev`

The UI does not need to preserve the current blue informational banner because that banner still suggests a soft demo mode rather than a hard runtime boundary.

## Testing Strategy

### API Tests

Update `src/api.test.ts` so that:

- non-Tauri runtime causes data reads to reject instead of returning fallback objects
- non-Tauri runtime causes previews and save actions to reject instead of returning stubbed success-like payloads
- Tauri runtime still maps real backend payloads correctly

Core assertion areas:

- `getPlatforms`
- `getAssets`
- `getFindings`
- `getScanRuns`
- `getSettings`
- `scanAssets`
- `previewOperation`
- `saveSettings`
- `previewSkillSyncPlan`
- `executeOperation` and `executeSkillSyncPlan` remain Tauri-only

### App-Level Tests

Add or update app-shell tests so that:

- non-Tauri runtime renders the blocking unsupported-runtime state
- Tauri runtime continues through the normal data-loading path
- first-run logic depends only on real scan-run payloads returned in Tauri mode

### Regression Guard

Add a repository-level expectation during review:

- no production runtime import of `src/data/mockData.ts`

This can be enforced by code review or by a focused test if a lightweight approach is available in the existing toolchain.

## Documentation Updates

Update user-facing development docs so they no longer describe browser fallback behavior as a supported runtime path.

Minimum updates:

- `README.md` should describe `npm run dev` as a shell-only frontend mode and `npm run tauri dev` as the path for real data.
- Project layout notes should stop labeling `src/api.ts` as a development fallback boundary.

## Rollout Plan

1. Lock the runtime contract in tests by making browser-mode API expectations fail first.
2. Remove runtime fallback branches from `src/api.ts`.
3. Replace the app-shell banner with a blocking unsupported-runtime state.
4. Remove or isolate `src/data/mockData.ts`.
5. Update docs and verify no production imports reference runtime mock data.
6. Run frontend tests, frontend build, and Rust tests/checks.

## Success Criteria

- No production runtime path returns fallback platforms, assets, findings, scan runs, settings, or previews.
- Browser mode does not impersonate a real product state.
- Tauri mode remains fully functional for scans, settings, operations, and sync flows.
- Tests explicitly protect the unsupported-runtime contract.
- Repository docs match the new runtime rule.

## Risks And Mitigations

### Risk: Frontend developers lose browser-mode convenience

Mitigation:

- keep the static shell runnable in the browser
- provide a clear blocking message and standardize on `npm run tauri dev` for business-flow validation

### Risk: Existing tests assume fallback objects

Mitigation:

- update tests before implementation
- remove fallback assumptions from assertions rather than silently adapting behavior

### Risk: Hidden runtime imports continue to depend on mock data

Mitigation:

- search for `mockData` and `fallback` references during implementation
- keep `src/api.ts` as the only supported business-data entry point for the frontend

## Acceptance Summary

This design is complete when the app no longer has any runtime path that fabricates business data, and the only supported source of product state is the real Tauri desktop backend.
