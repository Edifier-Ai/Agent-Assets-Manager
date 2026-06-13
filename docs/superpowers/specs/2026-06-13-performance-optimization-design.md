# Performance Optimization Design

> **For agentic workers:** After this spec is approved, invoke writing-plans to create the implementation plan.

**Goal:** Eliminate the three main performance bottlenecks: N+1 SQL queries on asset load, synchronous blocking file scan, and repeated platform binary detection on every call.

**Architecture:** All three fixes are backend-only changes to `db.rs`, `platform.rs`, and `commands.rs`. The frontend API contract is unchanged — `get_assets` still returns `Vec<Asset>` with embedded installations. The scan command becomes `async` at the Tauri command boundary while keeping the scan logic synchronous inside `spawn_blocking`.

**Tech Stack:** Rust / rusqlite / Tokio (already present via Tauri 2) / `std::sync::Mutex`

---

## Fix 1: N+1 Query in `get_all_assets`

### Problem

`db.rs:587-610` — `get_all_assets()` issues one `SELECT` for assets, then calls `get_asset_installations()` **per asset** inside `query_map`. With 100 assets this is 101 queries; with 500 it is 501.

### Solution

Replace the two-query loop with a single JOIN query. Fetch all assets and all their installations in one `SELECT`, then group installations by `asset_id` in a `HashMap<String, Vec<Installation>>` before assembling `Asset` structs.

### New `get_all_assets` signature

```rust
pub fn get_all_assets(conn: &Connection) -> SqlResult<Vec<Asset>>
```

Signature unchanged — callers (`commands.rs:get_assets`, `commands.rs:get_asset_detail`) need no modification.

### Query

```sql
SELECT
  a.id, a.asset_type, a.name, a.description, a.author, a.version,
  a.source, a.canonical_hash, a.directory_hash, a.risk_level,
  a.status, a.created_at, a.updated_at,
  i.id, i.asset_id, i.platform_id, i.path, i.scope, i.enabled,
  i.official, i.project_local, i.binding_type, i.content_hash,
  i.status as inst_status,
  COALESCE(p.name, i.platform_id) as platform_name
FROM assets a
LEFT JOIN installations i ON i.asset_id = a.id
LEFT JOIN platforms p ON p.id = i.platform_id
ORDER BY a.id
```

### Assembly logic

```rust
let mut asset_map: IndexMap<String, Asset> = IndexMap::new();
let mut inst_map: HashMap<String, Vec<Installation>> = HashMap::new();

// first pass: collect rows
// second pass: attach installations to assets in insertion order
```

Use `indexmap` crate (already available via transitive deps, or add explicitly) to preserve the original asset order. Alternatively, collect asset ids in a `Vec<String>` for ordering, and use a plain `HashMap<String, Asset>`.

### Files changed

- `src-tauri/src/db.rs` — rewrite `get_all_assets`, keep `get_asset_installations` as a private helper used only by tests

### Test

Existing `scanner_tests.rs` and `operations_tests.rs` call `get_all_assets` indirectly — run them to verify no regression. Add a unit test in `db.rs` that inserts 3 assets × 2 installations each and asserts all 6 installations are returned correctly grouped.

---

## Fix 2: Platform Detection Cache

### Problem

`platform.rs:92-135` — `detect_platforms_with_adapters()` spawns a login shell (`zsh -lc`) and runs `--version` for every adapter binary on every call. With 10 adapters × up to 1.2s timeout each, worst case is 12 seconds. This runs on every `scan_platforms` invocation from the frontend.

### Solution

Add a process-lifetime cache in Tauri app state. Cache holds the last detection result and the `Instant` it was computed. On subsequent calls within 60 seconds, return the cached result immediately.

### Cache type

```rust
pub struct PlatformCache {
    pub inner: Mutex<Option<(std::time::Instant, Vec<db::Platform>)>>,
}
```

Add `PlatformCache` to Tauri's `manage()` call in `lib.rs`.

### Cache TTL

60 seconds. Chosen because:
- Users rarely install/uninstall a platform in the same minute
- Fast enough to feel fresh after a manual rescan

### Cache invalidation

Explicitly invalidate (set to `None`) when `scan_assets` completes successfully, so the next `get_platforms` call after a full scan always reflects fresh data.

### Files changed

- `src-tauri/src/platform.rs` — add `PlatformCache` struct, add `detect_all_platforms_cached(cache: &PlatformCache)` function
- `src-tauri/src/lib.rs` — add `.manage(PlatformCache { inner: Mutex::new(None) })` to Tauri builder
- `src-tauri/src/commands.rs` — update `scan_platforms` to accept `State<PlatformCache>` and call the cached variant; update `scan_assets` to invalidate cache on success

### Test

Add a unit test in `platform.rs` that calls `detect_all_platforms_cached` twice with a 1ms sleep, verifying the second call returns in < 5ms (cache hit path does no I/O).

---

## Fix 3: Async Scan Command

### Problem

`commands.rs:66-99` — `scan_assets` is a synchronous Tauri command. `scanner::run_full_scan` calls `WalkDir` and hashes files synchronously, blocking Tauri's command thread. On a large config directory (10k+ files via deep scan) this freezes the UI for 10+ seconds.

### Solution

Make `scan_assets` an `async` Tauri command and offload the blocking scan work to `tokio::task::spawn_blocking`. The front end's `await` semantics are unchanged — it still gets a result when the scan finishes.

### New command signature

```rust
#[tauri::command]
pub async fn scan_assets(
    request: Option<ScanAssetsRequest>,
    cache: tauri::State<'_, PlatformCache>,
) -> ApiResponse<scanner::ScanResult> {
    let result = tokio::task::spawn_blocking(move || {
        // existing sync scan logic here
    }).await;
    // invalidate cache on success
    // return ApiResponse
}
```

Tauri 2 supports `async` commands natively — no additional setup required.

### Error handling

`spawn_blocking` returns `Result<T, JoinError>`. Map `JoinError` (task panicked) to `ApiResponse::err("scan task panicked: ...")`.

### Files changed

- `src-tauri/src/commands.rs` — change `scan_assets` to `async fn`, wrap body in `spawn_blocking`

### Test

The existing test suite runs synchronously; async behavior is verified by observing that the frontend remains responsive during a scan. No new unit tests needed for this change specifically — the scan logic itself is already tested in `scanner_tests.rs`.

---

## Scope

These three fixes are independent and can be implemented in any order. Recommended order: Fix 1 (highest correctness impact) → Fix 2 (best UX impact per effort) → Fix 3 (risk-of-regression lowest with existing tests).

## Out of Scope

- Pagination / virtual list for the frontend asset table (separate concern)
- Incremental scanning / file-watch (future work)
- Progress streaming during scan (future work)
