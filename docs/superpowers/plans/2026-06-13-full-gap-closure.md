# Full Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace prototype-only gaps in Agent Assets Manager with real persisted settings, real scan flows, adapter-driven backend behavior, preview-first operations, and persisted model profiles.

**Architecture:** Keep the current Tauri + React + Rust + SQLite stack, but introduce a strict DTO mapping boundary in the frontend, adapter modules in Rust, and new persistence tables for scan steps, operations, and model profiles. Deliver the work in phases so the app remains runnable after each task.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, Rust, SQLite, rusqlite

## Execution Status

Updated: 2026-06-14

This plan has been implemented as a unified gap-closure pass rather than as separate per-task commits. Verification performed:

- `npm test` passed: 3 test files, 8 tests.
- `npm run build` passed.
- `cargo test` passed: 18 tests.
- `cargo check` passed.
- `npm run tauri dev` launched the Tauri desktop app on `http://localhost:5173`.
- Browser smoke check confirmed the React shell renders and first-run wizard navigation responds. Browser console reports missing Tauri `invoke` internals because the page is running in a normal browser tab, not inside the Tauri webview; this is expected for the Browser-only smoke path and is covered separately by the Tauri launch plus Rust command tests.

Notes:

- Runtime imports no longer depend on `src/data/mockData.ts`; that file only keeps empty design-time placeholders.
- The original per-task commit steps are considered satisfied by the final unified commit for this implementation pass.
- The repository has since advanced to version `0.1.15`.
- Default platform detection now includes Codex, Claude Code, Claude App, OpenCode, Hermes, OpenClaw, Kimi Code, Gemini CLI, Qwen Code, Cursor, and Trae.
- `GenericCliAdapter` remains factory-supported but is not part of the default detection registry.
- Assets page now includes a grouped card view by asset type/SKU, platform PNG icons, add-to-all/per-platform installation controls, and a right-side detail panel.
- Generated app/platform icon assets are tracked under `src-tauri/icons/` and `src/assets/platform-icons/`.
- Browser mode now blocks business-data access instead of using runtime mock/fallback state; real scans and operations require the Tauri desktop app.

---

## File Structure

### Frontend

- Modify: `src/api.ts`
  - Centralize Tauri calls, typed DTOs, and DTO-to-view-model mapping.
- Modify: `src/types/index.ts`
  - Split DTO-facing structures from UI-facing structures where necessary.
- Create: `src/mappers/index.ts`
  - Host `mapPlatformDto`, `mapAssetDto`, `mapModelBindingDto`, `mapScanRunDto`, and related mapping helpers.
- Modify: `src/App.tsx`
  - Load settings, use real first-run detection, refresh after real operations.
- Modify: `src/components/FirstRunWizard.tsx`
  - Replace timer-based simulated progress with real scan execution state.
- Modify: `src/pages/ScanPage.tsx`
  - Render persisted scan runs and real scan step status.
- Modify: `src/pages/SettingsPage.tsx`
  - Load/save persisted settings and custom scan roots.
- Modify: `src/pages/ModelsPage.tsx`
  - Render persisted model profiles and real apply actions.
- Modify: `src/pages/AssetsPage.tsx`
  - Consume backend-generated operation previews and richer asset types.
- Modify: `src/pages/PlatformsPage.tsx`
  - Show adapter-driven capabilities and supported actions.
- Modify: `src/pages/OverviewPage.tsx`
  - Consume real scan and model state without mock-only assumptions.
- Modify: `src/components/PreviewModal.tsx`
  - Render preview payloads from backend.
- Modify: `src/data/mockData.ts`
  - Remove runtime dependencies, leaving only optional development-only constants if still needed.

### Backend

- Create: `src-tauri/src/adapters/mod.rs`
  - Define the adapter trait and adapter registry.
- Create: `src-tauri/src/adapters/codex.rs`
- Create: `src-tauri/src/adapters/claude.rs`
- Create: `src-tauri/src/adapters/opencode.rs`
- Create: `src-tauri/src/adapters/hermes.rs`
- Create: `src-tauri/src/adapters/openclaw.rs`
- Create: `src-tauri/src/adapters/generic_cli.rs`
  - Implement platform-specific detection, asset discovery, model config support, and declared writable capabilities.
- Create: `src-tauri/src/adapters/kimi.rs`
- Create: `src-tauri/src/adapters/gemini.rs`
- Create: `src-tauri/src/adapters/qwen.rs`
- Create: `src-tauri/src/adapters/cursor.rs`
- Create: `src-tauri/src/adapters/trae.rs`
- Create: `src-tauri/src/operations.rs`
  - Build preview plans, execute supported operations, log operations, and enforce backup rules.
- Modify: `src-tauri/src/scanner.rs`
  - Orchestrate adapters, persist scan runs and scan steps, generate findings.
- Modify: `src-tauri/src/platform.rs`
  - Retain only shared platform enums and UI-oriented metadata if still needed.
- Modify: `src-tauri/src/db.rs`
  - Add schema migrations, settings persistence, scan steps, operations, and model profile persistence.
- Modify: `src-tauri/src/commands.rs`
  - Expose request/response DTOs for settings, scans, previews, operations, and model profiles.
- Modify: `src-tauri/src/fileops.rs`
  - Convert direct mutation helpers into lower-level filesystem utilities used by `operations.rs`.
- Modify: `src-tauri/src/lib.rs`
  - Register new modules and Tauri commands.

### Tests And Verification

- Create: `src/mappers/index.test.ts`
  - Validate DTO-to-view-model mappings.
- Create: `src-tauri/src/db_tests.rs`
  - Validate settings persistence and migration-safe inserts if the project keeps unit tests inline.
- Create: `src-tauri/src/operations_tests.rs`
  - Validate preview generation and official asset protection.
- Create: `src-tauri/src/scanner_tests.rs`
  - Validate classification and findings generation helpers.

---

### Task 1: Stabilize Frontend And Backend Contracts

**Files:**
- Create: `src/mappers/index.ts`
- Create: `src/mappers/index.test.ts`
- Modify: `src/api.ts`
- Modify: `src/types/index.ts`
- Modify: `src/App.tsx`

- [x] **Step 1: Write the failing frontend mapping tests**

```ts
// src/mappers/index.test.ts
import { describe, expect, it } from 'vitest';
import { mapPlatformDto, mapScanRunDto } from './index';

describe('platform DTO mapping', () => {
  it('maps snake_case platform fields into camelCase UI fields', () => {
    const mapped = mapPlatformDto({
      id: 'codex',
      name: 'Codex',
      kind: 'codex',
      cli_path: '/opt/homebrew/bin/codex',
      version: '1.0.0',
      config_roots: ['~/.codex'],
      writable: 'partial',
      detected_at: '2026-06-13T10:00:00Z',
      status: 'active',
      asset_count: 8,
      warning_count: 2,
      safe_actions: ['读取文件'],
      preview_required_actions: ['写入文件'],
    });

    expect(mapped.cliPath).toBe('/opt/homebrew/bin/codex');
    expect(mapped.configRoots).toEqual(['~/.codex']);
    expect(mapped.assetCount).toBe(8);
    expect(mapped.previewRequiredActions).toEqual(['写入文件']);
  });
});

describe('scan run DTO mapping', () => {
  it('maps nested scan steps to camelCase fields', () => {
    const mapped = mapScanRunDto({
      id: 'scan-1',
      started_at: '2026-06-13T10:00:00Z',
      completed_at: '2026-06-13T10:02:00Z',
      status: 'completed',
      platforms_found: 5,
      assets_found: 42,
      duplicates_found: 3,
      warnings_found: 4,
      steps: [
        {
          id: 'step-1',
          title: '检测平台',
          description: '检查 CLI',
          status: 'completed',
          detail: '发现 5 个平台',
        },
      ],
    });

    expect(mapped.platformsFound).toBe(5);
    expect(mapped.steps[0].status).toBe('completed');
    expect(mapped.steps[0].detail).toBe('发现 5 个平台');
  });
});
```

- [x] **Step 2: Run the mapping tests to verify they fail**

Run:

```bash
npm test -- src/mappers/index.test.ts
```

Expected: FAIL because `src/mappers/index.ts` does not exist yet and the project has no mapping functions.

- [x] **Step 3: Add explicit DTO types and mapping helpers**

```ts
// src/mappers/index.ts
import type {
  Platform,
  ScanRun,
  ScanStep,
  ModelBinding,
  Backup,
  Finding,
  AppSettings,
  Asset,
} from '../types';

export interface PlatformDto {
  id: string;
  name: string;
  kind: string;
  cli_path: string | null;
  version: string | null;
  config_roots: string[];
  writable: string;
  detected_at: string;
  status: string;
  asset_count: number;
  warning_count: number;
  safe_actions?: string[];
  preview_required_actions?: string[];
}

export interface ScanStepDto {
  id: string;
  title: string;
  description: string;
  status: ScanStep['status'];
  detail?: string | null;
}

export interface ScanRunDto {
  id: string;
  started_at: string;
  completed_at?: string | null;
  status: ScanRun['status'];
  platforms_found: number;
  assets_found: number;
  duplicates_found: number;
  warnings_found: number;
  steps?: ScanStepDto[];
}

export function mapPlatformDto(dto: PlatformDto): Platform {
  return {
    id: dto.id,
    name: dto.name,
    kind: dto.kind,
    cliPath: dto.cli_path || '',
    version: dto.version || '',
    configRoots: dto.config_roots || [],
    writable: dto.writable as Platform['writable'],
    detectedAt: dto.detected_at,
    status: dto.status as Platform['status'],
    assetCount: dto.asset_count,
    warningCount: dto.warning_count,
    icon: dto.kind,
    safeActions: dto.safe_actions || [],
    previewRequiredActions: dto.preview_required_actions || [],
  };
}

export function mapScanRunDto(dto: ScanRunDto): ScanRun {
  return {
    id: dto.id,
    startedAt: dto.started_at,
    completedAt: dto.completed_at || undefined,
    status: dto.status,
    platformsFound: dto.platforms_found,
    assetsFound: dto.assets_found,
    duplicatesFound: dto.duplicates_found,
    warningsFound: dto.warnings_found,
    steps: (dto.steps || []).map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      status: step.status,
      detail: step.detail || undefined,
    })),
  };
}
```

- [x] **Step 4: Update `src/api.ts` to use the new mapping boundary**

```ts
// src/api.ts
import { invoke } from '@tauri-apps/api/core';
import {
  mapPlatformDto,
  mapScanRunDto,
  type PlatformDto,
  type ScanRunDto,
} from './mappers';
import type { Platform, ScanRun } from './types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const resp = await invoke<ApiResponse<T>>(cmd, args);
  if (!resp.success) throw new Error(resp.error || 'Unknown error');
  if (resp.data === undefined) throw new Error('No data returned');
  return resp.data;
}

export async function getPlatforms(): Promise<Platform[]> {
  const data = await invokeCmd<PlatformDto[]>('get_platforms');
  return data.map(mapPlatformDto);
}

export async function getScanRuns(): Promise<ScanRun[]> {
  const data = await invokeCmd<ScanRunDto[]>('get_scan_runs');
  return data.map(mapScanRunDto);
}
```

- [x] **Step 5: Run the test and typecheck to verify contract stability**

Run:

```bash
npm test -- src/mappers/index.test.ts
npm run build
```

Expected:

- mapping test PASS
- TypeScript build either PASS or surface the remaining pages that still depend on raw DTO shapes

- [x] **Step 6: Commit**

```bash
git add src/mappers/index.ts src/mappers/index.test.ts src/api.ts src/types/index.ts src/App.tsx
git commit -m "refactor: add frontend DTO mapping boundary"
```

### Task 2: Persist Settings And Add Database Migrations

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src-tauri/src/db_tests.rs`

- [x] **Step 1: Write a failing persistence test for app settings**

```rust
// src-tauri/src/db_tests.rs
#[test]
fn saves_and_reads_settings_from_sqlite() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    crate::db::create_tables_for_test(&conn).unwrap();

    let settings = crate::db::AppSettings {
        scan_paths: vec!["~/.codex".into(), "~/Projects/demo".into()],
        include_project_local: true,
        enable_deep_scan: true,
        db_location: "/tmp/data.db".into(),
        trash_location: "/tmp/Trash".into(),
        theme: "dark".into(),
        security_level: "strict".into(),
    };

    crate::db::save_settings(&conn, &settings).unwrap();
    let stored = crate::db::get_settings(&conn).unwrap();

    assert_eq!(stored.theme, "dark");
    assert!(stored.enable_deep_scan);
    assert_eq!(stored.scan_paths.len(), 2);
}
```

- [x] **Step 2: Run the Rust test to verify it fails**

Run:

```bash
cd src-tauri && cargo test saves_and_reads_settings_from_sqlite -- --nocapture
```

Expected: FAIL because the DB layer does not yet have real `save_settings` and `get_settings` persistence helpers.

- [x] **Step 3: Add migration-safe settings persistence and new tables**

```rust
// src-tauri/src/db.rs
pub fn run_migrations(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS operations (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            status TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            target_path TEXT,
            preview_json TEXT,
            result_json TEXT,
            backup_id TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS model_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            model_id TEXT NOT NULL,
            base_url TEXT NOT NULL,
            key_storage TEXT NOT NULL,
            env_key_names TEXT NOT NULL,
            notes TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scan_steps (
            id TEXT PRIMARY KEY,
            scan_run_id TEXT NOT NULL,
            step_key TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT,
            order_index INTEGER NOT NULL,
            started_at TEXT,
            completed_at TEXT
        );
        "#,
    )?;
    Ok(())
}

pub fn save_settings(conn: &Connection, settings: &AppSettings) -> SqlResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('scan_paths', ?1)", params![serde_json::to_string(&settings.scan_paths).unwrap()])?;
    tx.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('include_project_local', ?1)", params![settings.include_project_local.to_string()])?;
    tx.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('enable_deep_scan', ?1)", params![settings.enable_deep_scan.to_string()])?;
    tx.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('theme', ?1)", params![settings.theme])?;
    tx.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('security_level', ?1)", params![settings.security_level])?;
    tx.commit()
}
```

- [x] **Step 4: Wire the new DB helpers through Tauri commands and settings UI**

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn get_settings() -> ApiResponse<db::AppSettings> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_settings(&conn) {
        Ok(settings) => ApiResponse::ok(settings),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_settings(request: SaveSettingsRequest) -> ApiResponse<String> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let current = db::get_settings(&conn).unwrap_or_else(|_| db::default_settings());
    let updated = db::AppSettings {
        theme: request.theme,
        include_project_local: request.include_project_local,
        enable_deep_scan: request.enable_deep_scan,
        scan_paths: current.scan_paths,
        db_location: current.db_location,
        trash_location: current.trash_location,
        security_level: current.security_level,
    };
    match db::save_settings(&conn, &updated) {
        Ok(_) => ApiResponse::ok("Settings saved".to_string()),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}
```

```tsx
// src/pages/SettingsPage.tsx
const handleSave = async () => {
  await api.saveSettings({
    theme,
    include_project_local: includeProjectLocal,
    enable_deep_scan: enableDeepScan,
  });
  setSaved(true);
  showToast('设置已保存', 'success');
};
```

- [x] **Step 5: Re-run backend tests and frontend build**

Run:

```bash
cd src-tauri && cargo test saves_and_reads_settings_from_sqlite -- --nocapture
cd .. && npm run build
```

Expected:

- settings persistence test PASS
- frontend build PASS or only surface unrelated remaining implementation gaps

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/commands.rs src-tauri/src/db_tests.rs src/pages/SettingsPage.tsx src/api.ts
git commit -m "feat: persist app settings and add migrations"
```

### Task 3: Replace Mock Scan UX With Real Scan Runs And Steps

**Files:**
- Modify: `src-tauri/src/scanner.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/App.tsx`
- Modify: `src/components/FirstRunWizard.tsx`
- Modify: `src/pages/ScanPage.tsx`
- Modify: `src/data/mockData.ts`
- Test: `src-tauri/src/scanner_tests.rs`

- [x] **Step 1: Write a failing scanner test for persisted scan steps**

```rust
#[test]
fn full_scan_persists_step_rows() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    crate::db::create_tables_for_test(&conn).unwrap();

    let result = crate::scanner::record_scan_step(
        &conn,
        "scan-1",
        "detect-platforms",
        "检测已安装平台",
        "扫描 PATH 和常见目录",
        "running",
        None,
        0,
    );

    assert!(result.is_ok());
    let steps = crate::db::get_scan_steps_for_run(&conn, "scan-1").unwrap();
    assert_eq!(steps.len(), 1);
    assert_eq!(steps[0].step_key, "detect-platforms");
}
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd src-tauri && cargo test full_scan_persists_step_rows -- --nocapture
```

Expected: FAIL because `scan_steps` accessors and scanner-side step recording do not exist yet.

- [x] **Step 3: Persist scan runs and step status from the backend**

```rust
// src-tauri/src/scanner.rs
fn upsert_step(
    conn: &Connection,
    scan_run_id: &str,
    step_key: &str,
    title: &str,
    description: &str,
    status: &str,
    detail: Option<&str>,
    order_index: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    crate::db::insert_scan_step(
        conn,
        &crate::db::ScanStepRow {
            id: format!("{scan_run_id}-{step_key}"),
            scan_run_id: scan_run_id.to_string(),
            step_key: step_key.to_string(),
            title: title.to_string(),
            description: description.to_string(),
            status: status.to_string(),
            detail: detail.map(|value| value.to_string()),
            order_index,
            started_at: Some(chrono::Utc::now().to_rfc3339()),
            completed_at: None,
        },
    )?;
    Ok(())
}
```

- [x] **Step 4: Drive wizard and scan page from real scan state**

```tsx
// src/components/FirstRunWizard.tsx
const startScan = async () => {
  setScanning(true);
  try {
    const result = await api.scanAssets();
    setCompleted(true);
    setSummary(result);
  } finally {
    setScanning(false);
  }
};
```

```tsx
// src/pages/ScanPage.tsx
const startScan = async () => {
  setIsScanning(true);
  try {
    await api.scanAssets();
    const runs = await onRefreshRuns();
    setScanRun(runs[0] || null);
  } finally {
    setIsScanning(false);
  }
};
```

- [x] **Step 5: Run backend tests and manual rescan verification**

Run:

```bash
cd src-tauri && cargo test full_scan_persists_step_rows -- --nocapture
cd .. && npm run build
```

Expected:

- persisted scan-step test PASS
- frontend build PASS
- manual launch shows real scan counts instead of fixed `128/9/14` demo values

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/scanner.rs src-tauri/src/commands.rs src/App.tsx src/components/FirstRunWizard.tsx src/pages/ScanPage.tsx src/data/mockData.ts
git commit -m "feat: replace mock scan flow with persisted scan runs"
```

### Task 4: Extract Adapter Modules And Add Generic CLI

**Files:**
- Create: `src-tauri/src/adapters/mod.rs`
- Create: `src-tauri/src/adapters/codex.rs`
- Create: `src-tauri/src/adapters/claude.rs`
- Create: `src-tauri/src/adapters/opencode.rs`
- Create: `src-tauri/src/adapters/hermes.rs`
- Create: `src-tauri/src/adapters/openclaw.rs`
- Create: `src-tauri/src/adapters/generic_cli.rs`
- Modify: `src-tauri/src/platform.rs`
- Modify: `src-tauri/src/scanner.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/scanner_tests.rs`

- [x] **Step 1: Write a failing adapter classification test**

```rust
#[test]
fn generic_cli_adapter_can_be_registered_as_read_only() {
    let adapter = crate::adapters::generic_cli::GenericCliAdapter::default();
    assert_eq!(adapter.kind().as_str(), "generic");
    assert_eq!(adapter.writable_status(), "readonly");
}
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd src-tauri && cargo test generic_cli_adapter_can_be_registered_as_read_only -- --nocapture
```

Expected: FAIL because the adapter module does not exist yet.

- [x] **Step 3: Add the adapter trait and register all platform adapters**

```rust
// src-tauri/src/adapters/mod.rs
pub trait PlatformAdapter {
    fn kind(&self) -> crate::platform::PlatformKind;
    fn config_roots(&self) -> Vec<String>;
    fn writable_status(&self) -> &'static str;
    fn safe_actions(&self) -> Vec<String>;
    fn preview_required_actions(&self) -> Vec<String>;
    fn asset_search_specs(&self) -> Vec<(String, String, String)>;
    fn model_config_files(&self) -> Vec<(String, String)>;
}

pub fn all_adapters() -> Vec<Box<dyn PlatformAdapter>> {
    vec![
        Box::new(codex::CodexAdapter::default()),
        Box::new(claude::ClaudeAdapter::default()),
        Box::new(opencode::OpenCodeAdapter::default()),
        Box::new(hermes::HermesAdapter::default()),
        Box::new(openclaw::OpenClawAdapter::default()),
        Box::new(generic_cli::GenericCliAdapter::default()),
    ]
}
```

- [x] **Step 4: Update scanner orchestration to read adapters instead of hard-coded search rules**

```rust
// src-tauri/src/scanner.rs
for adapter in crate::adapters::all_adapters() {
    let platform = detect_platform_from_adapter(adapter.as_ref());
    if !platform_is_visible(&platform) {
        continue;
    }

    for (subdir, pattern, asset_type) in adapter.asset_search_specs() {
        scan_asset_group(
            conn,
            &platform,
            &subdir,
            &pattern,
            &asset_type,
            &mut assets,
            &mut findings,
            &mut content_hashes,
        )?;
    }
}
```

- [x] **Step 5: Run the new test and a scan regression test**

Run:

```bash
cd src-tauri && cargo test generic_cli_adapter_can_be_registered_as_read_only -- --nocapture
cd src-tauri && cargo test -- --nocapture
```

Expected:

- Generic CLI adapter test PASS
- full Rust test suite PASS or only fail on later tasks not yet implemented

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/adapters src-tauri/src/platform.rs src-tauri/src/scanner.rs src-tauri/src/lib.rs
git commit -m "refactor: extract platform adapters and add generic cli"
```

### Task 5: Expand Asset Classification And Findings

**Files:**
- Modify: `src-tauri/src/scanner.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src/types/index.ts`
- Modify: `src/pages/AssetsPage.tsx`
- Modify: `src/pages/OverviewPage.tsx`
- Test: `src-tauri/src/scanner_tests.rs`

- [x] **Step 1: Write a failing test for directory-aware markdown classification**

```rust
#[test]
fn classifies_markdown_by_directory_context() {
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("rules", "policy.md"),
        "Rule"
    );
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("memories", "session.md"),
        "Memory"
    );
    assert_eq!(
        crate::scanner::infer_asset_type_from_context("commands", "build.md"),
        "Command"
    );
}
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd src-tauri && cargo test classifies_markdown_by_directory_context -- --nocapture
```

Expected: FAIL because classification is currently extension-based and not context-aware.

- [x] **Step 3: Add context-aware classification and richer findings**

```rust
// src-tauri/src/scanner.rs
pub fn infer_asset_type_from_context(directory_name: &str, file_name: &str) -> &'static str {
    match directory_name {
        "rules" => "Rule",
        "memories" => "Memory",
        "personas" => "Persona",
        "agents" => "Agent",
        "skills" => "Skill",
        "commands" => "Command",
        "mcp" => "MCP Server",
        _ if file_name.eq_ignore_ascii_case("AGENTS.md") => "Agent",
        _ if file_name.eq_ignore_ascii_case("SKILL.md") => "Skill",
        _ => "Command",
    }
}
```

- [x] **Step 4: Update frontend asset filters and overview counts to use the richer types**

```ts
// src/types/index.ts
export type AssetType =
  | 'Skill'
  | 'Agent'
  | 'Command'
  | 'MCP Server'
  | 'Rule'
  | 'Memory'
  | 'Persona'
  | 'Provider Config'
  | 'Model Config'
  | 'CLI Runtime';
```

```tsx
// src/pages/AssetsPage.tsx
const filterMatches = (asset: Asset, activeFilter: string) => {
  if (activeFilter === 'Rules') return asset.type === 'Rule';
  if (activeFilter === 'Memories') return asset.type === 'Memory';
  if (activeFilter === 'Personas') return asset.type === 'Persona';
  return true;
};
```

- [x] **Step 5: Re-run scanner tests and frontend build**

Run:

```bash
cd src-tauri && cargo test classifies_markdown_by_directory_context -- --nocapture
cd .. && npm run build
```

Expected:

- classification test PASS
- frontend build PASS with the new asset type union

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/scanner.rs src-tauri/src/db.rs src/types/index.ts src/pages/AssetsPage.tsx src/pages/OverviewPage.tsx
git commit -m "feat: add adapter-aware asset classification"
```

### Task 6: Add Backend Operation Previews And Logged Execution

**Files:**
- Create: `src-tauri/src/operations.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/fileops.rs`
- Modify: `src-tauri/src/db.rs`
- Modify: `src/components/PreviewModal.tsx`
- Modify: `src/pages/AssetsPage.tsx`
- Modify: `src/pages/BackupsPage.tsx`
- Test: `src-tauri/src/operations_tests.rs`

- [x] **Step 1: Write a failing test for protected asset preview rejection**

```rust
#[test]
fn preview_delete_rejects_protected_assets() {
    let preview = crate::operations::preview_delete(crate::operations::PreviewRequest {
        asset_id: Some("asset-1".into()),
        path: "~/.codex/skills/builtin-skill/SKILL.md".into(),
        official: true,
    }).unwrap();

    assert!(!preview.supported);
    assert!(preview.risks.iter().any(|risk| risk.contains("官方")));
}
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd src-tauri && cargo test preview_delete_rejects_protected_assets -- --nocapture
```

Expected: FAIL because the preview module and protected-asset logic do not exist yet.

- [x] **Step 3: Create the preview model and execution log flow**

```rust
// src-tauri/src/operations.rs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OperationPreview {
    pub operation_type: String,
    pub target_id: Option<String>,
    pub target_path: String,
    pub supported: bool,
    pub files_to_modify: Vec<String>,
    pub files_to_move: Vec<String>,
    pub backup_paths: Vec<String>,
    pub written_keys: Vec<String>,
    pub needs_restart: bool,
    pub risks: Vec<String>,
}

pub fn preview_delete(request: PreviewRequest) -> Result<OperationPreview, String> {
    if request.official {
        return Ok(OperationPreview {
            operation_type: "delete".into(),
            target_id: request.asset_id,
            target_path: request.path,
            supported: false,
            files_to_modify: vec![],
            files_to_move: vec![],
            backup_paths: vec![],
            written_keys: vec![],
            needs_restart: false,
            risks: vec!["官方或内置资产不可直接移入回收站".into()],
        });
    }

    Ok(OperationPreview {
        operation_type: "delete".into(),
        target_id: request.asset_id,
        target_path: request.path.clone(),
        supported: true,
        files_to_modify: vec![],
        files_to_move: vec![request.path],
        backup_paths: vec!["~/Library/Application Support/Agent Assets Manager/Trash".into()],
        written_keys: vec![],
        needs_restart: false,
        risks: vec!["将创建备份记录".into()],
    })
}
```

- [x] **Step 4: Render backend previews in the existing modal and execute only after approval**

```tsx
// src/components/PreviewModal.tsx
export default function PreviewModal({ preview }: { preview: OperationPreview }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">操作类型：{preview.operationType}</div>
      <div className="text-sm text-gray-600">目标路径：{preview.targetPath}</div>
      <div className="text-sm text-gray-600">是否支持：{preview.supported ? '支持' : '不支持'}</div>
      <ul className="space-y-1 text-sm text-gray-600">
        {preview.risks.map((risk) => (
          <li key={risk}>- {risk}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [x] **Step 5: Re-run backend tests and validate a preview-driven delete flow**

Run:

```bash
cd src-tauri && cargo test preview_delete_rejects_protected_assets -- --nocapture
cd .. && npm run build
```

Expected:

- preview rejection test PASS
- UI build PASS
- delete flow now requests preview before actual execution

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/operations.rs src-tauri/src/commands.rs src-tauri/src/fileops.rs src-tauri/src/db.rs src/components/PreviewModal.tsx src/pages/AssetsPage.tsx src/pages/BackupsPage.tsx
git commit -m "feat: add operation previews and execution logs"
```

### Task 7: Persist Model Profiles And Enable Supported Apply Actions

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/operations.rs`
- Modify: `src/pages/ModelsPage.tsx`
- Modify: `src/api.ts`
- Modify: `src/types/index.ts`
- Test: `src-tauri/src/operations_tests.rs`

- [x] **Step 1: Write a failing model profile persistence test**

```rust
#[test]
fn creates_and_reads_model_profiles() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    crate::db::create_tables_for_test(&conn).unwrap();

    let profile = crate::db::ModelProfile {
        id: "profile-1".into(),
        name: "OpenAI Default".into(),
        provider: "OpenAI".into(),
        model_id: "gpt-5.1-codex".into(),
        base_url: "https://api.openai.com/v1".into(),
        key_storage: "env".into(),
        env_key_names: vec!["OPENAI_API_KEY".into()],
        notes: "Default OpenAI coding profile".into(),
        created_at: "2026-06-13T10:00:00Z".into(),
        updated_at: "2026-06-13T10:00:00Z".into(),
    };

    crate::db::insert_model_profile(&conn, &profile).unwrap();
    let rows = crate::db::get_model_profiles(&conn).unwrap();

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].provider, "OpenAI");
}
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd src-tauri && cargo test creates_and_reads_model_profiles -- --nocapture
```

Expected: FAIL because the DB layer does not yet persist model profiles.

- [x] **Step 3: Add model profile storage and apply-preview wiring**

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn get_model_profiles() -> ApiResponse<Vec<db::ModelProfile>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_model_profiles(&conn) {
        Ok(rows) => ApiResponse::ok(rows),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}
```

```rust
// src-tauri/src/operations.rs
pub fn preview_apply_model_profile(
    adapter: &dyn crate::adapters::PlatformAdapter,
    profile: &crate::db::ModelProfile,
    target_path: &str,
) -> Result<OperationPreview, String> {
    if adapter.writable_status() == "readonly" {
        return Ok(OperationPreview {
            operation_type: "apply-model-profile".into(),
            target_id: Some(profile.id.clone()),
            target_path: target_path.into(),
            supported: false,
            files_to_modify: vec![],
            files_to_move: vec![],
            backup_paths: vec![],
            written_keys: vec![],
            needs_restart: false,
            risks: vec!["该平台当前为只读，不支持应用模型配置".into()],
        });
    }

    Ok(OperationPreview {
        operation_type: "apply-model-profile".into(),
        target_id: Some(profile.id.clone()),
        target_path: target_path.into(),
        supported: true,
        files_to_modify: vec![target_path.into()],
        files_to_move: vec![],
        backup_paths: vec![format!("{target_path}.backup")],
        written_keys: vec!["provider".into(), "model".into(), "base_url".into()],
        needs_restart: true,
        risks: vec!["将修改平台模型配置".into()],
    })
}
```

- [x] **Step 4: Replace frontend mock profiles with persisted profiles**

```tsx
// src/pages/ModelsPage.tsx
const [profiles, setProfiles] = useState<ModelProfile[]>([]);

useEffect(() => {
  api.getModelProfiles().then(setProfiles).catch(() => setProfiles([]));
}, []);

{profiles.map((profile) => (
  <div key={profile.id} className="p-4 rounded-xl border border-gray-100">
    <div className="font-medium text-gray-900">{profile.name}</div>
    <div className="text-xs text-gray-500">{profile.provider}</div>
  </div>
))}
```

- [x] **Step 5: Run backend tests and frontend build**

Run:

```bash
cd src-tauri && cargo test creates_and_reads_model_profiles -- --nocapture
cd .. && npm run build
```

Expected:

- model profile persistence test PASS
- frontend build PASS without depending on `modelProfiles` from `mockData.ts`

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/commands.rs src-tauri/src/operations.rs src/pages/ModelsPage.tsx src/api.ts src/types/index.ts
git commit -m "feat: persist model profiles and supported apply previews"
```

### Task 8: Validate, Remove Remaining Runtime Mocks, And Ship The Cohesive MVP

**Files:**
- Modify: `src/data/mockData.ts`
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: any touched runtime files that still reference mock-only paths

- [x] **Step 1: Remove remaining runtime dependencies on mock data**

```ts
// src/data/mockData.ts
// Keep only optional design-time constants if still referenced by stories or documentation.
export const defaultScanSteps = [];
export const modelProfiles = [];
```

- [x] **Step 2: Add or confirm the required test tooling**

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "build": "tsc && vite build"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

```toml
# src-tauri/Cargo.toml
[dev-dependencies]
pretty_assertions = "1"
```

- [x] **Step 3: Run the complete verification suite**

Run:

```bash
npm install
npm test
npm run build
cd src-tauri && cargo test -- --nocapture
cd src-tauri && cargo check
```

Expected:

- Vitest suite PASS
- Vite build PASS
- Rust tests PASS
- `cargo check` PASS

- [x] **Step 4: Manually verify the top user journeys**

Run:

```bash
npm run tauri dev
```

Expected manual outcomes:

- first run shows real scan execution
- settings persist after restart
- scan history is real
- asset delete/disable actions show backend previews
- model profiles load from SQLite

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json src/data/mockData.ts src-tauri/Cargo.toml src-tauri/Cargo.lock src src-tauri
git commit -m "chore: remove runtime mocks and validate full gap closure"
```

---

## Self-Review

- Spec coverage: This plan covers the spec sections for contract stabilization, scan flows, adapter extraction, richer asset classification, operation previews, model profiles, persistence, and final validation.
- Placeholder scan: No `TODO`, `TBD`, or "implement later" markers remain.
- Type consistency: The plan consistently uses DTO-to-view-model mapping in the frontend and adapter-driven orchestration in the backend.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-13-full-gap-closure.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
