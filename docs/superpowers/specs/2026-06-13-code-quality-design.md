# Code Quality: Adapter Deduplication & Frontend Tests Design

> **For agentic workers:** After this spec is approved, invoke writing-plans to create the implementation plan.

**Goal:** Reduce adapter boilerplate by ~70% using a Rust macro, and add Vitest tests for the three untested frontend pages (ScanPage, ModelsPage, PlatformsPage).

**Architecture:** Macro lives in `adapters/mod.rs` — no new files for adapters. Frontend tests follow the existing pattern in `AssetsPage.test.ts` and `SettingsPage.test.ts`: import the page, mock the api module, render with `@testing-library/react` (if available) or test pure logic functions directly.

**Tech Stack:** Rust macros / Vitest / TypeScript

---

## Part 1: Adapter Deduplication Macro

### Problem

10 adapter files (`claude.rs`, `codex.rs`, `cursor.rs`, `gemini.rs`, `hermes.rs`, `kimi.rs`, `openclaw.rs`, `opencode.rs`, `qwen.rs`, `trae.rs`) each implement `PlatformAdapter` with identical structure. The only differences are: `kind`, `binary_names`, `config_roots`, `writable_status`, `asset_search_specs`, and `model_config_files`. Each file is ~55 lines.

### Solution

Define `define_adapter!` macro in `adapters/mod.rs`. Each adapter file becomes ~15 lines.

### Macro definition (in `adapters/mod.rs`)

```rust
#[macro_export]
macro_rules! define_adapter {
    (
        $struct_name:ident,
        kind: $kind:expr,
        binaries: [$($bin:literal),*],
        config_root: $root:expr,
        writable: $writable:literal,
        search_specs: [$( { subdir: $subdir:literal, pattern: $pattern:literal, asset_type: $atype:literal } ),*],
        model_configs: [$( { filename: $fname:literal, format: $fmt:literal } ),*]
    ) => {
        #[derive(Default)]
        pub struct $struct_name;

        impl $crate::adapters::PlatformAdapter for $struct_name {
            fn kind(&self) -> $crate::platform::PlatformKind { $kind }

            fn binary_names(&self) -> Vec<&'static str> { vec![$($bin),*] }

            fn config_roots(&self) -> Vec<String> {
                vec![$crate::adapters::home_root($root)]
            }

            fn writable_status(&self) -> &'static str { $writable }

            fn asset_search_specs(&self) -> Vec<$crate::adapters::AssetSearchSpec> {
                vec![
                    $($crate::adapters::AssetSearchSpec {
                        subdir: $subdir,
                        pattern: $pattern,
                        asset_type: $atype,
                    }),*
                ]
            }

            fn model_config_files(&self) -> Vec<$crate::adapters::ModelConfigSpec> {
                vec![
                    $($crate::adapters::ModelConfigSpec {
                        filename: $fname,
                        format: $fmt,
                        writable_keys: $crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                        merge_strategy: $crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
                    }),*
                ]
            }
        }
    };
}
```

### Example: `claude.rs` after macro

```rust
crate::define_adapter!(
    ClaudeAdapter,
    kind: crate::platform::PlatformKind::Claude,
    binaries: ["claude"],
    config_root: ".claude",
    writable: "readonly",
    search_specs: [
        { subdir: "skills",   pattern: "SKILL.md",  asset_type: "Skill"   },
        { subdir: "agents",   pattern: "AGENTS.md", asset_type: "Agent"   },
        { subdir: "commands", pattern: ".md",        asset_type: "Command" }
    ],
    model_configs: [
        { filename: "config.json", format: "json" }
    ]
);
```

### Adapters that need custom handling

Two adapters deviate from the standard pattern and are **NOT** converted to the macro:

- **`cursor.rs`** — `config_roots()` returns `home_root(".cursor")` (standard), but `asset_search_specs` uses `"skills-cursor"` as subdir (non-standard name). The macro handles this fine — just pass `"skills-cursor"` as `subdir`.
- **`generic_cli.rs`** — Has a `with_roots(Vec<String>)` constructor and stores custom roots in a field. Cannot use the macro. Keep as-is.
- **`trae.rs`** — Has two config roots (`".trae"` and `".trae-cn"`). The macro takes a single `config_root`. Either extend the macro to support `config_roots: [...]` or keep `trae.rs` as-is.

**Decision:** Extend macro to accept `config_roots: [$($root:expr),*]` instead of `config_root: $root:expr`. This handles both single-root and multi-root adapters. `generic_cli.rs` remains unconverted.

### Adapters converted (9 of 10)

`claude`, `codex`, `cursor`, `gemini`, `hermes`, `kimi`, `openclaw`, `opencode`, `qwen`, `trae` — all 10 converted using the extended macro. `generic_cli` remains unchanged.

### Files changed

- `src-tauri/src/adapters/mod.rs` — add `define_adapter!` macro
- `src-tauri/src/adapters/claude.rs` — replace with macro invocation
- `src-tauri/src/adapters/codex.rs` — replace with macro invocation
- `src-tauri/src/adapters/cursor.rs` — replace with macro invocation
- `src-tauri/src/adapters/gemini.rs` — replace with macro invocation
- `src-tauri/src/adapters/hermes.rs` — replace with macro invocation
- `src-tauri/src/adapters/kimi.rs` — replace with macro invocation
- `src-tauri/src/adapters/openclaw.rs` — replace with macro invocation
- `src-tauri/src/adapters/opencode.rs` — replace with macro invocation
- `src-tauri/src/adapters/qwen.rs` — replace with macro invocation
- `src-tauri/src/adapters/trae.rs` — replace with macro invocation

### Verification

Run `cargo test` — existing scanner and platform tests exercise all adapters transitively. All 32 tests must pass. Run `cargo clippy` to confirm no macro-expansion warnings.

---

## Part 2: Frontend Test Coverage

### Current state

`AssetsPage.test.ts` and `SettingsPage.test.ts` test pure logic functions exported from those pages (filter logic, grouping, sanitization). No DOM rendering tests — the project uses Vitest without `@testing-library/react`. This pattern is correct and fast.

### Strategy

Follow the same pattern: test pure exported functions and logic helpers, not DOM rendering. Each test file imports the page's exported utility functions and tests them in isolation.

### `src/pages/ScanPage.test.ts`

`ScanPage.tsx` doesn't export testable functions currently. Add and export:

```typescript
// in ScanPage.tsx
export function formatScanTime(value: string): string { ... } // already defined, just export
export function isScanRunComplete(run: ScanRun): boolean {
  return run.status === 'completed' || run.status === 'failed';
}
```

Tests:
```typescript
describe('formatScanTime', () => {
  it('formats ISO string to zh-CN locale string', () => {
    const result = formatScanTime('2026-06-13T08:00:00.000Z');
    expect(result).toContain('2026');
  });
});

describe('isScanRunComplete', () => {
  it('returns true for completed', () => {
    expect(isScanRunComplete({ status: 'completed' } as ScanRun)).toBe(true);
  });
  it('returns true for failed', () => {
    expect(isScanRunComplete({ status: 'failed' } as ScanRun)).toBe(true);
  });
  it('returns false for running', () => {
    expect(isScanRunComplete({ status: 'running' } as ScanRun)).toBe(false);
  });
});
```

### `src/pages/ModelsPage.test.ts`

`ModelsPage.tsx` exports `supportsApplyPreview` and `getApplySupportLabel` (currently private). Export them:

```typescript
export function supportsApplyPreview(platform?: Platform): boolean { ... }
export function getApplySupportLabel(platform?: Platform): string { ... }
```

Tests:
```typescript
describe('supportsApplyPreview', () => {
  it('returns false for readonly platform', () => {
    expect(supportsApplyPreview({ writable: 'readonly' } as Platform)).toBe(false);
  });
  it('returns true for partial platform', () => {
    expect(supportsApplyPreview({ writable: 'partial' } as Platform)).toBe(true);
  });
  it('returns true for writable platform', () => {
    expect(supportsApplyPreview({ writable: 'writable' } as Platform)).toBe(true);
  });
  it('returns false when platform is undefined', () => {
    expect(supportsApplyPreview(undefined)).toBe(false);
  });
});

describe('getApplySupportLabel', () => {
  it('returns missing message when platform undefined', () => {
    expect(getApplySupportLabel(undefined)).toBe('平台信息缺失');
  });
  it('returns readonly message', () => {
    expect(getApplySupportLabel({ writable: 'readonly' } as Platform)).toBe('当前平台只读');
  });
});
```

### `src/pages/PlatformsPage.test.ts`

`PlatformsPage.tsx` has no exported functions. Add and export a helper:

```typescript
export function getPlatformStatusLabel(status: string): 'enabled' | 'disabled' {
  return status === 'active' ? 'enabled' : 'disabled';
}
```

Tests:
```typescript
describe('getPlatformStatusLabel', () => {
  it('maps active to enabled', () => {
    expect(getPlatformStatusLabel('active')).toBe('enabled');
  });
  it('maps inactive to disabled', () => {
    expect(getPlatformStatusLabel('inactive')).toBe('disabled');
  });
  it('maps unknown to disabled', () => {
    expect(getPlatformStatusLabel('unknown')).toBe('disabled');
  });
});
```

### `src/pages/OperationsPage.test.ts`

Add alongside the new `OperationsPage.tsx` (from the Feature Completion spec). Export:

```typescript
export function getOperationTypeLabel(type: string): string { ... } // from OP_LABELS map
export function isOperationComplete(log: OperationLog): boolean {
  return log.status === 'completed' || log.status === 'failed';
}
```

Tests:
```typescript
describe('getOperationTypeLabel', () => {
  it('maps delete to 删除', () => {
    expect(getOperationTypeLabel('delete')).toBe('删除');
  });
  it('returns raw value for unknown type', () => {
    expect(getOperationTypeLabel('unknown-op')).toBe('unknown-op');
  });
});

describe('isOperationComplete', () => {
  it('returns true for completed', () => {
    expect(isOperationComplete({ status: 'completed' } as OperationLog)).toBe(true);
  });
  it('returns false for running', () => {
    expect(isOperationComplete({ status: 'running' } as OperationLog)).toBe(false);
  });
});
```

### Files changed

| File | Change |
|------|--------|
| `src-tauri/src/adapters/mod.rs` | Add `define_adapter!` macro |
| `src-tauri/src/adapters/claude.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/codex.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/cursor.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/gemini.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/hermes.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/kimi.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/openclaw.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/opencode.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/qwen.rs` | Replace with macro invocation |
| `src-tauri/src/adapters/trae.rs` | Replace with macro invocation |
| `src/pages/ScanPage.tsx` | Export `formatScanTime`, add + export `isScanRunComplete` |
| `src/pages/ModelsPage.tsx` | Export `supportsApplyPreview`, `getApplySupportLabel` |
| `src/pages/PlatformsPage.tsx` | Add + export `getPlatformStatusLabel` |
| `src/pages/OperationsPage.tsx` | Export `getOperationTypeLabel`, `isOperationComplete` |
| `src/pages/ScanPage.test.ts` | New test file |
| `src/pages/ModelsPage.test.ts` | New test file |
| `src/pages/PlatformsPage.test.ts` | New test file |
| `src/pages/OperationsPage.test.ts` | New test file |

---

## Out of Scope

- `generic_cli.rs` adapter conversion (custom constructor, cannot use macro)
- DOM rendering tests (project pattern is pure-logic tests only)
- BackupsPage tests (page has minimal logic; existing pattern not broken)
- Property-based tests / fuzzing
