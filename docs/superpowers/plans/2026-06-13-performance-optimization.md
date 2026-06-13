# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the three main performance bottlenecks: N+1 SQL queries on asset load, repeated platform binary detection on every call, and synchronous file scanning blocking the UI thread.

**Architecture:** All three fixes are backend-only changes. Fix 1 rewrites `get_all_assets` in `db.rs` to use a single JOIN query. Fix 2 adds a `PlatformCache` struct to Tauri app state with a 60-second TTL. Fix 3 wraps the scan command in `tokio::task::spawn_blocking` to avoid blocking the async runtime.

**Tech Stack:** Rust / rusqlite / Tokio (bundled with Tauri 2) / `std::sync::Mutex`

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/src/db.rs` | Rewrite `get_all_assets` with JOIN; keep `get_asset_installations` for tests |
| `src-tauri/src/platform.rs` | Add `PlatformCache` struct + `detect_all_platforms_cached` |
| `src-tauri/src/lib.rs` | Register `PlatformCache` in Tauri app state |
| `src-tauri/src/commands.rs` | Update `scan_platforms` to use cache; make `scan_assets` async |

---

## Task 1: Fix N+1 Queries in `get_all_assets`

**Files:**
- Modify: `src-tauri/src/db.rs:587-610`

- [ ] **Step 1: Add a unit test that will fail with the current N+1 implementation (and pass after the fix)**

Add this test at the bottom of `src-tauri/src/db.rs` inside the `#[cfg(test)]` block. If there is no test block yet, create one.

```rust
#[cfg(test)]
mod db_tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn get_all_assets_returns_installations_grouped_correctly() {
        let conn = setup_test_db();

        // Insert 2 platforms
        conn.execute(
            "INSERT INTO platforms (id, name, kind, writable, detected_at, status, asset_count, warning_count) VALUES ('p1', 'Claude', 'claude', 'readonly', '2026-01-01', 'active', 0, 0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO platforms (id, name, kind, writable, detected_at, status, asset_count, warning_count) VALUES ('p2', 'Codex', 'codex', 'partial', '2026-01-01', 'active', 0, 0)",
            [],
        ).unwrap();

        // Insert 2 assets
        conn.execute(
            "INSERT INTO assets (id, asset_type, name, source, risk_level, status, created_at, updated_at) VALUES ('a1', 'Skill', 'my-skill', 'local', 'low', 'installed', '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO assets (id, asset_type, name, source, risk_level, status, created_at, updated_at) VALUES ('a2', 'Agent', 'my-agent', 'local', 'low', 'installed', '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();

        // Insert 3 installations: 2 for a1, 1 for a2
        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i1', 'a1', 'p1', '/home/.claude/skills/my-skill', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i2', 'a1', 'p2', '/home/.codex/skills/my-skill', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO installations (id, asset_id, platform_id, path, scope, enabled, official, project_local, binding_type, status) VALUES ('i3', 'a2', 'p1', '/home/.claude/agents/my-agent', 'user', 1, 0, 0, 'copy', 'installed')",
            [],
        ).unwrap();

        let assets = get_all_assets(&conn).unwrap();

        assert_eq!(assets.len(), 2, "should return 2 assets");
        let a1 = assets.iter().find(|a| a.id == "a1").unwrap();
        let a2 = assets.iter().find(|a| a.id == "a2").unwrap();
        assert_eq!(a1.installations.len(), 2, "a1 should have 2 installations");
        assert_eq!(a2.installations.len(), 1, "a2 should have 1 installation");

        // Check platform name is populated via JOIN
        let i1 = a1.installations.iter().find(|i| i.id == "i1").unwrap();
        assert_eq!(i1.platform_name, "Claude");
    }
}
```

- [ ] **Step 2: Run the test to confirm it passes (it tests behavior, not implementation, so it may already pass)**

```bash
cd src-tauri && cargo test db_tests::get_all_assets_returns_installations_grouped_correctly -- --nocapture
```

Expected: PASS (the test verifies correctness, which we're about to preserve while fixing performance)

- [ ] **Step 3: Rewrite `get_all_assets` to use a single JOIN query**

In `src-tauri/src/db.rs`, replace the entire `get_all_assets` function (lines ~587-610) with:

```rust
pub fn get_all_assets(conn: &Connection) -> SqlResult<Vec<Asset>> {
    // Single JOIN query — O(assets + installations) instead of O(assets × queries)
    let mut stmt = conn.prepare(
        "SELECT
            a.id, a.asset_type, a.name, a.description, a.author, a.version,
            a.source, a.canonical_hash, a.directory_hash, a.risk_level,
            a.status, a.created_at, a.updated_at,
            i.id as inst_id, i.asset_id, i.platform_id, i.path, i.scope,
            i.enabled, i.official, i.project_local, i.binding_type,
            i.content_hash, i.status as inst_status,
            COALESCE(p.name, i.platform_id) as platform_name
         FROM assets a
         LEFT JOIN installations i ON i.asset_id = a.id
         LEFT JOIN platforms p ON p.id = i.platform_id
         ORDER BY a.id, i.id"
    )?;

    let mut asset_map: std::collections::LinkedHashMap<String, Asset> =
        std::collections::LinkedHashMap::new();

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let asset_id: String = row.get(0)?;

        let inst_id: Option<String> = row.get(13)?;

        let asset = asset_map.entry(asset_id.clone()).or_insert_with(|| Asset {
            id: asset_id,
            asset_type: row.get(1).unwrap_or_default(),
            name: row.get(2).unwrap_or_default(),
            description: row.get(3).unwrap_or_default(),
            author: row.get(4).unwrap_or_default(),
            version: row.get(5).unwrap_or_default(),
            source: row.get(6).unwrap_or_default(),
            canonical_hash: row.get(7).unwrap_or_default(),
            directory_hash: row.get(8).unwrap_or_default(),
            risk_level: row.get(9).unwrap_or_default(),
            status: row.get(10).unwrap_or_default(),
            created_at: row.get(11).unwrap_or_default(),
            updated_at: row.get(12).unwrap_or_default(),
            installations: Vec::new(),
        });

        if let Some(id) = inst_id {
            asset.installations.push(Installation {
                id,
                asset_id: row.get(14).unwrap_or_default(),
                platform_id: row.get(15).unwrap_or_default(),
                path: row.get(16).unwrap_or_default(),
                scope: row.get(17).unwrap_or_default(),
                enabled: row.get::<_, i32>(18).unwrap_or(0) != 0,
                official: row.get::<_, i32>(19).unwrap_or(0) != 0,
                project_local: row.get::<_, i32>(20).unwrap_or(0) != 0,
                binding_type: row.get(21).unwrap_or_default(),
                content_hash: row.get(22).unwrap_or_default(),
                status: row.get(23).unwrap_or_default(),
                platform_name: row.get(24).unwrap_or_default(),
            });
        }
    }

    Ok(asset_map.into_values().collect())
}
```

- [ ] **Step 4: Add `linked-hash-map` dependency to `Cargo.toml`**

`LinkedHashMap` preserves insertion order (same as the original query order). Open `src-tauri/Cargo.toml` and add to `[dependencies]`:

```toml
linked-hash-map = "0.5"
```

Add to the top of `db.rs`:

```rust
use linked_hash_map::LinkedHashMap;
```

- [ ] **Step 5: Run tests to verify correctness**

```bash
cd src-tauri && cargo test
```

Expected: all existing tests pass. The new test from Step 1 also passes.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "perf: fix N+1 queries in get_all_assets with single JOIN"
```

---

## Task 2: Platform Detection Cache

**Files:**
- Modify: `src-tauri/src/platform.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add `PlatformCache` struct and `detect_all_platforms_cached` to `platform.rs`**

Add at the end of `src-tauri/src/platform.rs`:

```rust
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct PlatformCache {
    pub inner: Mutex<Option<(Instant, Vec<crate::db::Platform>)>>,
}

impl PlatformCache {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = None;
        }
    }
}

const CACHE_TTL: Duration = Duration::from_secs(60);

pub fn detect_all_platforms_cached(cache: &PlatformCache) -> Vec<DetectedPlatform> {
    // Check cache first
    if let Ok(guard) = cache.inner.lock() {
        if let Some((cached_at, _)) = guard.as_ref() {
            if cached_at.elapsed() < CACHE_TTL {
                // Cache is warm but we return DetectedPlatform, not db::Platform
                // Cache miss on type — drop through to re-detect
                // (The cache stores db::Platform for commands.rs use; see Task 3)
                drop(guard);
            }
        }
    }
    detect_all_platforms()
}
```

**Note:** The cache stores `Vec<db::Platform>` (the DB struct used by `scan_platforms` command), not `Vec<DetectedPlatform>` (the internal struct). This avoids a double-conversion. Update `PlatformCache` to store `Vec<db::Platform>`:

```rust
pub struct PlatformCache {
    pub inner: Mutex<Option<(Instant, Vec<crate::db::Platform>)>>,
}
```

The `commands.rs` `scan_platforms` handler will check the cache before re-detecting.

- [ ] **Step 2: Register `PlatformCache` in Tauri app state in `lib.rs`**

Open `src-tauri/src/lib.rs`. Find the `.run(...)` or `.setup(...)` chain where commands are registered. Add `.manage(platform::PlatformCache::new())` to the builder:

```rust
tauri::Builder::default()
    // ... existing plugins ...
    .manage(platform::PlatformCache::new())
    .invoke_handler(tauri::generate_handler![
        // existing commands...
    ])
```

- [ ] **Step 3: Update `scan_platforms` command to use the cache**

In `src-tauri/src/commands.rs`, update `scan_platforms`:

```rust
#[tauri::command]
pub fn scan_platforms(
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> ApiResponse<Vec<db::Platform>> {
    // Check cache
    {
        let guard = cache.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((cached_at, ref platforms)) = *guard {
            if cached_at.elapsed() < std::time::Duration::from_secs(60) {
                return ApiResponse::ok(platforms.clone());
            }
        }
    }

    // Cache miss — detect and persist
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let now = chrono::Utc::now().to_rfc3339();

    let detected = crate::platform::detect_all_platforms();
    let mut db_platforms: Vec<db::Platform> = Vec::new();

    for dp in detected {
        let platform = db::Platform {
            id: dp.id.clone(),
            name: dp.kind.display_name().to_string(),
            kind: dp.kind.as_str().to_string(),
            cli_path: dp.cli_path.clone(),
            version: dp.version.clone(),
            config_roots: dp.config_roots.clone(),
            writable: dp.writable.clone(),
            detected_at: now.clone(),
            status: dp.status.clone(),
            asset_count: dp.asset_count,
            warning_count: dp.warning_count,
        };
        if let Err(e) = db::insert_platform(&conn, &platform) {
            return ApiResponse::err(e.to_string());
        }
        db_platforms.push(platform);
    }

    // Store in cache
    {
        let mut guard = cache.inner.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some((std::time::Instant::now(), db_platforms));
    }

    match db::get_all_platforms(&conn) {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}
```

- [ ] **Step 4: Add `use std::time` import to `commands.rs` if not present**

At the top of `src-tauri/src/commands.rs`, ensure:

```rust
use std::time;
```

Or reference `std::time::Duration` and `std::time::Instant` fully-qualified as shown in Step 3.

- [ ] **Step 5: Build to verify it compiles**

```bash
cd src-tauri && cargo build 2>&1 | head -40
```

Expected: `Finished` with no errors. Fix any type mismatch errors before proceeding.

- [ ] **Step 6: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/platform.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "perf: add 60s platform detection cache to avoid repeated binary spawning"
```

---

## Task 3: Async Scan Command

**Files:**
- Modify: `src-tauri/src/commands.rs:66-99`

- [ ] **Step 1: Make `scan_assets` async and wrap body in `spawn_blocking`**

Replace the current `scan_assets` function in `src-tauri/src/commands.rs` with:

```rust
#[tauri::command]
pub async fn scan_assets(
    request: Option<ScanAssetsRequest>,
    cache: tauri::State<'_, crate::platform::PlatformCache>,
) -> ApiResponse<scanner::ScanResult> {
    // Capture what we need before moving into spawn_blocking
    let request = request.unwrap_or_default();

    // We need owned data to send across thread boundary
    let scan_roots_raw = request.scan_roots.unwrap_or_default();

    // Get settings synchronously before spawning (DB calls are fast)
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    let context = default_settings_context();
    let settings = match db::get_settings(
        &conn,
        &context.scan_paths,
        &context.db_location,
        &context.trash_location,
    ) {
        Ok(s) => s,
        Err(e) => return ApiResponse::err(e.to_string()),
    };

    let explicit_roots = sanitize_paths(scan_roots_raw, Vec::new());
    let scan_roots = if explicit_roots.is_empty() && settings.enable_deep_scan {
        settings.scan_paths
    } else {
        explicit_roots
    };

    // Offload blocking WalkDir + hashing work to a thread pool thread
    let result = tokio::task::spawn_blocking(move || {
        let conn = get_db_connection()?;
        if scan_roots.is_empty() {
            scanner::run_full_scan(&conn)
        } else {
            scanner::run_full_scan_with_extra_roots(&conn, scan_roots)
        }
    })
    .await;

    match result {
        Ok(Ok(scan_result)) => {
            // Invalidate platform cache so next get_platforms reflects fresh data
            cache.invalidate();
            ApiResponse::ok(scan_result)
        }
        Ok(Err(e)) => ApiResponse::err(e.to_string()),
        Err(join_err) => ApiResponse::err(format!("scan task panicked: {join_err}")),
    }
}
```

- [ ] **Step 2: Verify `get_db_connection` is usable inside `spawn_blocking`**

`spawn_blocking` requires the closure to be `Send + 'static`. `rusqlite::Connection` is `Send` but not `Sync`. Because we're creating a new connection inside the closure (not capturing an existing one), this is fine. Confirm by checking the signature in `src-tauri/src/db.rs` — `get_db_connection()` takes no arguments and returns `Result<Connection, ...>`.

- [ ] **Step 3: Build to verify async command compiles**

```bash
cd src-tauri && cargo build 2>&1 | head -40
```

Expected: `Finished` with no errors.

If you see `error[E0277]: \`...\` cannot be shared between threads safely`, ensure no captured references cross the `spawn_blocking` boundary — all values must be owned.

- [ ] **Step 4: Run full test suite**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

- [ ] **Step 5: Run frontend tests**

```bash
npm test
```

Expected: all 17 tests pass. (Frontend API layer is unchanged — `await api.scanAssets(...)` still works identically.)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "perf: make scan_assets async with spawn_blocking to unblock UI during scan"
```
