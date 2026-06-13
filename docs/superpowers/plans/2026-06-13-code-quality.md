# Code Quality: Adapter Deduplication & Frontend Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce adapter boilerplate by ~70% using a `define_adapter!` macro, and add Vitest unit tests for three previously untested frontend pages.

**Architecture:** The macro lives in `adapters/mod.rs` and is applied to all 10 standard adapters. `generic_cli.rs` is unchanged (it has a custom constructor). Frontend tests follow the existing pattern: test exported pure functions, no DOM rendering.

**Tech Stack:** Rust macros / Vitest / TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/src/adapters/mod.rs` | Add `define_adapter!` macro |
| `src-tauri/src/adapters/claude.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/codex.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/cursor.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/gemini.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/hermes.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/kimi.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/openclaw.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/opencode.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/qwen.rs` | Replace body with macro invocation |
| `src-tauri/src/adapters/trae.rs` | Replace body with macro invocation |
| `src/pages/ScanPage.tsx` | Export `formatScanTime`, add + export `isScanRunComplete` |
| `src/pages/ModelsPage.tsx` | Export `supportsApplyPreview`, `getApplySupportLabel` |
| `src/pages/PlatformsPage.tsx` | Add + export `getPlatformStatusLabel` |
| `src/pages/ScanPage.test.ts` | New test file |
| `src/pages/ModelsPage.test.ts` | New test file |
| `src/pages/PlatformsPage.test.ts` | New test file |

---

## Task 1: Add `define_adapter!` Macro

**Files:**
- Modify: `src-tauri/src/adapters/mod.rs`

- [ ] **Step 1: Read the existing adapter files to understand all variants**

Before writing the macro, read one complex adapter to confirm field shapes. Run:

```bash
cat src-tauri/src/adapters/trae.rs
```

Note that `trae.rs` has two config roots (`".trae"` and `".trae-cn"`). The macro must support multiple roots.

- [ ] **Step 2: Add `define_adapter!` macro to `src-tauri/src/adapters/mod.rs`**

Add this block after the existing `pub use` and trait definitions, before `pub fn all_adapters()`:

```rust
/// Generates a standard PlatformAdapter implementation.
/// Supports multiple config roots (for platforms like Trae with two directories).
#[macro_export]
macro_rules! define_adapter {
    (
        $struct_name:ident,
        kind: $kind:expr,
        binaries: [$($bin:literal),* $(,)?],
        config_roots: [$($root:expr),* $(,)?],
        writable: $writable:literal,
        search_specs: [
            $( { subdir: $subdir:literal, pattern: $pattern:literal, asset_type: $atype:literal } ),* $(,)?
        ],
        model_configs: [
            $( { filename: $fname:literal, format: $fmt:literal } ),* $(,)?
        ]
    ) => {
        #[derive(Default)]
        pub struct $struct_name;

        impl $crate::adapters::PlatformAdapter for $struct_name {
            fn kind(&self) -> $crate::platform::PlatformKind {
                $kind
            }

            fn binary_names(&self) -> Vec<&'static str> {
                vec![$($bin),*]
            }

            fn config_roots(&self) -> Vec<String> {
                vec![$($crate::adapters::home_root($root)),*]
            }

            fn writable_status(&self) -> &'static str {
                $writable
            }

            fn asset_search_specs(&self) -> Vec<$crate::adapters::AssetSearchSpec> {
                vec![
                    $(
                        $crate::adapters::AssetSearchSpec {
                            subdir: $subdir,
                            pattern: $pattern,
                            asset_type: $atype,
                        }
                    ),*
                ]
            }

            fn model_config_files(&self) -> Vec<$crate::adapters::ModelConfigSpec> {
                vec![
                    $(
                        $crate::adapters::ModelConfigSpec {
                            filename: $fname,
                            format: $fmt,
                            writable_keys: $crate::adapters::STANDARD_MODEL_WRITABLE_KEYS,
                            merge_strategy: $crate::adapters::ROOT_OBJECT_MERGE_STRATEGY,
                        }
                    ),*
                ]
            }
        }
    };
}
```

Also make `home_root` pub so macro invocations in submodules can access it. Find `fn home_root` in `mod.rs` and change to `pub fn home_root`.

- [ ] **Step 3: Build to verify the macro compiles in isolation**

```bash
cd src-tauri && cargo build 2>&1 | head -20
```

Expected: `Finished` — no errors from the macro definition itself.

- [ ] **Step 4: Commit the macro before touching any adapter**

```bash
git add src-tauri/src/adapters/mod.rs
git commit -m "refactor: add define_adapter! macro to adapters/mod.rs"
```

---

## Task 2: Convert Adapters One by One

Convert each adapter file. The approach is identical for all — replace the entire file contents with a macro invocation. Do them one at a time so `cargo build` catches issues early.

### 2a: `claude.rs`

**Files:** Modify: `src-tauri/src/adapters/claude.rs`

- [ ] **Step 1: Replace `claude.rs` contents**

```rust
crate::define_adapter!(
    ClaudeAdapter,
    kind: crate::platform::PlatformKind::Claude,
    binaries: ["claude"],
    config_roots: [".claude"],
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

- [ ] **Step 2: Build**

```bash
cd src-tauri && cargo build 2>&1 | head -20
```

Expected: `Finished`.

### 2b: `codex.rs`

**Files:** Modify: `src-tauri/src/adapters/codex.rs`

- [ ] **Step 1: Replace `codex.rs` contents**

```rust
crate::define_adapter!(
    CodexAdapter,
    kind: crate::platform::PlatformKind::Codex,
    binaries: ["codex"],
    config_roots: [".codex"],
    writable: "partial",
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

- [ ] **Step 2: Build**

```bash
cd src-tauri && cargo build 2>&1 | head -20
```

Expected: `Finished`.

### 2c: `cursor.rs`

**Files:** Modify: `src-tauri/src/adapters/cursor.rs`

- [ ] **Step 1: Replace `cursor.rs` contents**

```rust
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
```

- [ ] **Step 2: Build**

```bash
cd src-tauri && cargo build 2>&1 | head -20
```

Expected: `Finished`.

### 2d: `gemini.rs`

**Files:** Modify: `src-tauri/src/adapters/gemini.rs`

- [ ] **Step 1: Read the current file to confirm specs**

```bash
cat src-tauri/src/adapters/gemini.rs
```

- [ ] **Step 2: Replace `gemini.rs` contents**

```rust
crate::define_adapter!(
    GeminiAdapter,
    kind: crate::platform::PlatformKind::Gemini,
    binaries: ["gemini"],
    config_roots: [".gemini"],
    writable: "partial",
    search_specs: [
        { subdir: "",         pattern: ".md",       asset_type: "Rule"    },
        { subdir: "skills",   pattern: "SKILL.md",  asset_type: "Skill"   },
        { subdir: "commands", pattern: ".md",        asset_type: "Command" }
    ],
    model_configs: [
        { filename: "settings.json", format: "json" }
    ]
);
```

- [ ] **Step 3: Build**

```bash
cd src-tauri && cargo build 2>&1 | head -20
```

Expected: `Finished`.

### 2e–2j: Remaining adapters (`hermes`, `kimi`, `openclaw`, `opencode`, `qwen`, `trae`)

For each, read the current file first, then replace with the macro invocation.

- [ ] **Step 1: Read and replace `hermes.rs`**

```bash
cat src-tauri/src/adapters/hermes.rs
```

Replace contents with the macro, using the binary names, config root, writable status, search specs, and model configs from the current file.

- [ ] **Step 2: Read and replace `kimi.rs`**

```bash
cat src-tauri/src/adapters/kimi.rs
```

Replace contents with the macro.

- [ ] **Step 3: Read and replace `openclaw.rs`**

```bash
cat src-tauri/src/adapters/openclaw.rs
```

Replace contents with the macro.

- [ ] **Step 4: Read and replace `opencode.rs`**

```bash
cat src-tauri/src/adapters/opencode.rs
```

Replace contents with the macro.

- [ ] **Step 5: Read and replace `qwen.rs`**

```bash
cat src-tauri/src/adapters/qwen.rs
```

Replace contents with the macro.

- [ ] **Step 6: Read and replace `trae.rs`**

```bash
cat src-tauri/src/adapters/trae.rs
```

`trae.rs` has **two** config roots. Use the multi-root form:

```rust
crate::define_adapter!(
    TraeAdapter,
    kind: crate::platform::PlatformKind::Trae,
    binaries: ["trae"],
    config_roots: [".trae", ".trae-cn"],
    writable: "partial",
    search_specs: [
        // (copy from current file)
    ],
    model_configs: [
        // (copy from current file)
    ]
);
```

- [ ] **Step 7: Build all adapters together**

```bash
cd src-tauri && cargo build 2>&1 | head -30
```

Expected: `Finished` with no errors.

- [ ] **Step 8: Run full test suite**

```bash
cd src-tauri && cargo test
```

Expected: all 32 tests pass. The adapter refactor is behavior-preserving — existing scanner and platform tests exercise every adapter.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/adapters/
git commit -m "refactor: convert all standard adapters to define_adapter! macro (~70% less boilerplate)"
```

---

## Task 3: Frontend Test Coverage — ScanPage

**Files:**
- Modify: `src/pages/ScanPage.tsx`
- Create: `src/pages/ScanPage.test.ts`

- [ ] **Step 1: Export testable functions from `ScanPage.tsx`**

Open `src/pages/ScanPage.tsx`. Find `function formatScanTime` (currently unexported). Change it and add `isScanRunComplete`:

```typescript
export function formatScanTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function isScanRunComplete(run: Pick<ScanRun, 'status'>): boolean {
  return run.status === 'completed' || run.status === 'failed';
}
```

- [ ] **Step 2: Create `src/pages/ScanPage.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { formatScanTime, isScanRunComplete } from './ScanPage';
import type { ScanRun } from '../types';

describe('formatScanTime', () => {
  it('returns a string containing the year', () => {
    const result = formatScanTime('2026-06-13T08:00:00.000Z');
    expect(result).toContain('2026');
  });

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatScanTime('2026-01-01T00:00:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('isScanRunComplete', () => {
  it('returns true for completed status', () => {
    expect(isScanRunComplete({ status: 'completed' } as ScanRun)).toBe(true);
  });

  it('returns true for failed status', () => {
    expect(isScanRunComplete({ status: 'failed' } as ScanRun)).toBe(true);
  });

  it('returns false for running status', () => {
    expect(isScanRunComplete({ status: 'running' } as ScanRun)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A15 "ScanPage"
```

Expected: all ScanPage tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ScanPage.tsx src/pages/ScanPage.test.ts
git commit -m "test: add ScanPage unit tests"
```

---

## Task 4: Frontend Test Coverage — ModelsPage

**Files:**
- Modify: `src/pages/ModelsPage.tsx`
- Create: `src/pages/ModelsPage.test.ts`

- [ ] **Step 1: Export `supportsApplyPreview` and `getApplySupportLabel` from `ModelsPage.tsx`**

Open `src/pages/ModelsPage.tsx`. Find:

```typescript
function supportsApplyPreview(platform?: Platform): boolean {
```

Change both functions to exported:

```typescript
export function supportsApplyPreview(platform?: Platform): boolean {
  return Boolean(platform && platform.writable !== 'readonly');
}

export function getApplySupportLabel(platform?: Platform): string {
  if (!platform) {
    return '平台信息缺失';
  }
  if (platform.writable === 'readonly') {
    return '当前平台只读';
  }
  if (platform.writable === 'partial') {
    return '支持受控写入预览';
  }
  return '支持应用预览';
}
```

- [ ] **Step 2: Create `src/pages/ModelsPage.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { supportsApplyPreview, getApplySupportLabel } from './ModelsPage';
import type { Platform } from '../types';

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
  it('returns missing message when platform is undefined', () => {
    expect(getApplySupportLabel(undefined)).toBe('平台信息缺失');
  });

  it('returns readonly message for readonly platform', () => {
    expect(getApplySupportLabel({ writable: 'readonly' } as Platform)).toBe('当前平台只读');
  });

  it('returns partial message for partial platform', () => {
    expect(getApplySupportLabel({ writable: 'partial' } as Platform)).toBe('支持受控写入预览');
  });

  it('returns full support message for writable platform', () => {
    expect(getApplySupportLabel({ writable: 'writable' } as Platform)).toBe('支持应用预览');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A20 "ModelsPage"
```

Expected: all ModelsPage tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ModelsPage.tsx src/pages/ModelsPage.test.ts
git commit -m "test: add ModelsPage unit tests"
```

---

## Task 5: Frontend Test Coverage — PlatformsPage

**Files:**
- Modify: `src/pages/PlatformsPage.tsx`
- Create: `src/pages/PlatformsPage.test.ts`

- [ ] **Step 1: Add and export `getPlatformStatusLabel` to `PlatformsPage.tsx`**

Open `src/pages/PlatformsPage.tsx`. At the top of the file (after imports), add:

```typescript
export function getPlatformStatusLabel(status: string): 'enabled' | 'disabled' {
  return status === 'active' ? 'enabled' : 'disabled';
}
```

- [ ] **Step 2: Create `src/pages/PlatformsPage.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { getPlatformStatusLabel } from './PlatformsPage';

describe('getPlatformStatusLabel', () => {
  it('maps active to enabled', () => {
    expect(getPlatformStatusLabel('active')).toBe('enabled');
  });

  it('maps inactive to disabled', () => {
    expect(getPlatformStatusLabel('inactive')).toBe('disabled');
  });

  it('maps empty string to disabled', () => {
    expect(getPlatformStatusLabel('')).toBe('disabled');
  });

  it('maps unknown value to disabled', () => {
    expect(getPlatformStatusLabel('unknown')).toBe('disabled');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A10 "PlatformsPage"
```

Expected: all PlatformsPage tests PASS.

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlatformsPage.tsx src/pages/PlatformsPage.test.ts
git commit -m "test: add PlatformsPage unit tests"
```
