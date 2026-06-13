# Runtime Real Data Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every runtime mock/fallback business-data path so the app only serves real data in Tauri and blocks unsupported browser mode.

**Architecture:** Keep the current Tauri + React + Rust + SQLite shape, but tighten the frontend boundary. `src/api.ts` becomes a strict Tauri-only gateway with one unsupported-runtime error, while `src/App.tsx` renders a blocking non-Tauri state instead of loading believable fake data. Tests lock the contract before implementation and docs explain that `npm run dev` is shell-only.

**Tech Stack:** React 18, TypeScript, Vitest, Tauri 2, Rust, SQLite, Vite

---

## File Structure

- `src/api.ts`
  - Owns the frontend business-data boundary to Tauri commands.
  - Must stop importing runtime fallback collections and must throw a consistent unsupported-runtime error outside Tauri.
- `src/api.test.ts`
  - Locks the API contract so browser mode rejects instead of returning fake data.
- `src/App.tsx`
  - Owns runtime-entry UX and should render a blocking non-Tauri state before business bootstrapping.
- `src/App.test.tsx`
  - New app-shell regression test for unsupported runtime UI.
- `src/data/mockData.ts`
  - Delete after runtime code and tests stop depending on it.
- `README.md`
  - Must describe `npm run dev` as shell-only and `npm run tauri dev` as the real-data path.

### Task 1: Lock The API Runtime Contract In Tests

**Files:**
- Modify: `src/api.test.ts`
- Test: `src/api.test.ts`

- [ ] **Step 1: Rewrite the API tests so browser mode expects rejection instead of fallback data**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const isTauriMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

const UNSUPPORTED_RUNTIME_MESSAGE = 'Real business data is available only in the Tauri desktop app.';

const sampleOperationRequest = {
  operationType: 'disable',
  targetId: 'asset-1',
  targetName: 'review',
  targetType: 'Command',
  targetPath: '/tmp/review.md',
  official: false,
} as const;

describe('api runtime contract', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
  });

  it('rejects browser-mode read APIs outside Tauri', async () => {
    const api = await import('./api');

    await expect(api.getPlatforms()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getAssets()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getFindings()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getScanRuns()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getSettings()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.scanAssets()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('rejects browser-mode preview and write APIs outside Tauri', async () => {
    const api = await import('./api');

    await expect(api.previewOperation(sampleOperationRequest)).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.saveSettings({
      theme: 'dark',
      scanPaths: ['~/.codex'],
      includeProjectLocal: false,
      enableDeepScan: true,
      dbLocation: '/tmp/dev-data.db',
      trashLocation: '/tmp/dev-trash',
    })).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.previewSkillSyncPlan(['skill-1'], 'mirror')).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
  });

  it('keeps Tauri command failures user readable', async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({ success: false, error: 'database unavailable' });
    const api = await import('./api');

    await expect(api.getAssets()).rejects.toThrow('database unavailable');
  });
});
```

- [ ] **Step 2: Run the focused API test to verify it fails for the right reason**

Run: `npm test -- src/api.test.ts`

Expected: `FAIL` because `src/api.ts` still resolves fallback data or exposes `isDevelopmentFallbackMode()` instead of rejecting browser-mode calls.

- [ ] **Step 3: Commit the red test change**

```bash
git add src/api.test.ts
git commit -m "test: lock non-tauri api contract"
```

### Task 2: Make `src/api.ts` Strictly Tauri-Only

**Files:**
- Modify: `src/api.ts`
- Delete: `src/data/mockData.ts`
- Test: `src/api.test.ts`

- [ ] **Step 1: Add a shared runtime guard and remove the fallback imports/state**

```ts
import { invoke, isTauri as isTauriCoreRuntime } from '@tauri-apps/api/core';
import {
  mapModelProfileDto,
  mapAssetDto,
  mapBackupDto,
  mapFindingDto,
  mapModelBindingDto,
  mapOperationExecutionResultDto,
  mapOperationLogDto,
  mapOperationPreviewDto,
  mapOperationRequest,
  mapPlatformDto,
  mapSaveSettingsInput,
  mapScanRunDto,
  mapScanSummaryDto,
  mapSettingsDto,
  mapBatchSyncPreviewDto,
  mapBatchSyncResultDto,
  mapBatchSyncRequest,
  type AppSettingsDto,
  type AssetDto,
  type BackupDto,
  type FindingDto,
  type ModelBindingDto,
  type ModelProfileDto,
  type OperationExecutionResultDto,
  type OperationLogDto,
  type OperationPreviewDto,
  type OperationRequestDto,
  type PlatformDto,
  type ScanRunDto,
  type ScanSummaryDto,
  type BatchSyncPreviewDto,
  type BatchSyncResultDto,
} from './mappers';

export const UNSUPPORTED_RUNTIME_MESSAGE =
  'Real business data is available only in the Tauri desktop app.';

export function isTauriRuntime(): boolean {
  return isTauriCoreRuntime();
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error(UNSUPPORTED_RUNTIME_MESSAGE);
  }
}
```

- [ ] **Step 2: Apply the guard to every business API and remove fallback-only helpers**

```ts
export async function getPlatforms(): Promise<Platform[]> {
  ensureTauriRuntime();
  const data = await invokeCmd<PlatformDto[]>('get_platforms');
  return data.map(mapPlatformDto);
}

export async function getAssetDetail(assetId: string): Promise<Asset> {
  ensureTauriRuntime();
  const data = await invokeCmd<AssetDto>('get_asset_detail', { request: { asset_id: assetId } });
  return mapAssetDto(data);
}

export async function previewOperation(request: OperationRequest): Promise<OperationPreview> {
  ensureTauriRuntime();
  const data = await invokeCmd<OperationPreviewDto>('preview_operation', {
    request: mapOperationRequest(request) as OperationRequestDto,
  });
  return mapOperationPreviewDto(data);
}

export async function saveSettings(settings: SaveSettingsInput): Promise<string> {
  ensureTauriRuntime();
  return invokeCmd('save_settings', { request: mapSaveSettingsInput(settings) });
}

export async function previewSkillSyncPlan(
  assetIds: string[],
  strategy: string,
  sourcePlatformId?: string,
): Promise<BatchSyncPreview> {
  ensureTauriRuntime();
  const data = await invokeCmd<BatchSyncPreviewDto>('preview_skill_sync_plan', {
    request: { asset_ids: assetIds, strategy, source_platform_id: sourcePlatformId ?? null },
  });
  return mapBatchSyncPreviewDto(data);
}
```

Implementation notes for this step:

- Remove `isDevelopmentFallbackMode()`.
- Remove `developmentFallbackSettings`.
- Remove `buildFallbackBatchSyncPreview()`.
- Apply `ensureTauriRuntime()` to `scanPlatforms`, `scanAssets`, `getPlatforms`, `getAssets`, `getModelBindings`, `getModelProfiles`, `getBackups`, `getOperationLogs`, `getFindings`, `getScanRuns`, `getAssetDetail`, `previewOperation`, `executeOperation`, `getSettings`, `saveSettings`, `previewSkillSyncPlan`, and `executeSkillSyncPlan`.
- Delete `src/data/mockData.ts` after the file has no runtime imports.

- [ ] **Step 3: Run the focused API test to verify the new guard passes**

Run: `npm test -- src/api.test.ts`

Expected: `PASS`

- [ ] **Step 4: Commit the API boundary change**

```bash
git add src/api.ts src/api.test.ts
git rm src/data/mockData.ts
git commit -m "refactor: require tauri for runtime data"
```

### Task 3: Block Unsupported Browser Runtime In The App Shell

**Files:**
- Create: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add an app-shell test that fails until non-Tauri is blocked**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isTauriRuntimeMock = vi.fn();

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    isTauriRuntime: isTauriRuntimeMock,
  };
});

import App from './App';

describe('App runtime boundary', () => {
  beforeEach(() => {
    isTauriRuntimeMock.mockReset();
  });

  it('renders a blocking message outside Tauri', () => {
    isTauriRuntimeMock.mockReturnValue(false);

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('当前运行在浏览器壳中');
    expect(html).toContain('仅 Tauri 桌面应用支持真实数据');
    expect(html).toContain('npm run tauri dev');
  });

  it('does not render the blocking message inside Tauri', () => {
    isTauriRuntimeMock.mockReturnValue(true);

    const html = renderToStaticMarkup(<App />);

    expect(html).not.toContain('当前运行在浏览器壳中');
  });
});
```

- [ ] **Step 2: Run the app-shell test to verify it fails before UI changes**

Run: `npm test -- src/App.test.tsx`

Expected: `FAIL` because `src/App.tsx` still renders the old fallback-mode banner instead of a blocking unsupported-runtime state.

- [ ] **Step 3: Replace the fallback banner with an early blocking state in `src/App.tsx`**

```tsx
function UnsupportedRuntimeState() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">当前运行在浏览器壳中</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前环境不会读取任何本机业务数据，应用已移除 fallback/mock 数据路径。
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          仅 Tauri 桌面应用支持真实数据、扫描、设置保存和批量操作预览。
        </p>
        <div className="mt-5 rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100">
          npm run tauri dev
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  if (!api.isTauriRuntime()) {
    return <UnsupportedRuntimeState />;
  }

  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  // keep the existing state and data-loading flow below this point
}
```

Implementation notes for this step:

- Remove `const developmentFallbackMode = api.isDevelopmentFallbackMode();`
- Remove the blue fallback banner block entirely.
- Keep the existing Tauri data-loading flow unchanged after the early guard.

- [ ] **Step 4: Re-run the app-shell test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: `PASS`

- [ ] **Step 5: Commit the app-shell runtime boundary**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: block browser runtime business data"
```

### Task 4: Update Docs And Run Final Verification

**Files:**
- Modify: `README.md`
- Test: `src/api.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Update README to describe the new runtime contract**

````md
## Development

Run the web shell:

```bash
npm run dev
```

This starts the frontend shell only. It does not load real local business data.

Run the Tauri desktop app:

```bash
npm run tauri dev
```

Use this path for real scans, settings, previews, and other business flows.
````

Also update the project-layout line from:

```text
api.ts                  Tauri command boundary and development fallback behavior
```

to:

```text
api.ts                  Tauri-only command boundary for runtime business data
```

- [ ] **Step 2: Verify no production runtime file still references removed fallback paths**

Run: `grep -R "isDevelopmentFallbackMode\|mockData\|fallbackAssets\|fallbackPlatforms\|fallbackScanRuns\|fallbackSettings" src README.md`

Expected: no matches

- [ ] **Step 3: Run the relevant frontend tests and build**

Run: `npm test -- src/api.test.ts src/App.test.tsx && npm run build`

Expected:

- `PASS` for `src/api.test.ts`
- `PASS` for `src/App.test.tsx`
- successful Vite production build

- [ ] **Step 4: Run the Rust verification commands to make sure frontend boundary changes did not break desktop integration**

Run: `cd src-tauri && cargo test && cargo check`

Expected:

- `test result: ok`
- `Finished` without new errors

- [ ] **Step 5: Commit the docs and verification pass**

```bash
git add README.md
git commit -m "docs: clarify tauri-only runtime data path"
```

## Spec Coverage Check

- Runtime mock/fallback removal: covered by Task 1 and Task 2.
- Blocking unsupported browser mode: covered by Task 3.
- Delete or isolate `src/data/mockData.ts`: covered by Task 2.
- Documentation updates: covered by Task 4.
- Regression protection in tests: covered by Task 1 and Task 3.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Every code-changing step includes concrete code or exact commands.
- Each task ends in a small, reviewable commit.

## Type Consistency Check

- Runtime guard naming is consistent: `UNSUPPORTED_RUNTIME_MESSAGE` and `ensureTauriRuntime()`.
- The non-Tauri test contract uses the same message in API tests and implementation.
- `App.tsx` runtime UI depends only on `api.isTauriRuntime()`, matching the API boundary design.
