# Feature Completion: Operation History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing `operations` table as a new Operations page in the UI, giving users a persistent audit trail of every delete, disable, install, restore, and model-apply action.

**Architecture:** Add one Tauri command (`get_operation_logs`), one DB read function, one frontend type + mapper, one new page (`OperationsPage`), and wire it into the existing nav. The `operations` table is already populated — this is pure read-path plumbing plus a new page. `NavPage` union gets a new `'operations'` variant.

**Tech Stack:** Rust / rusqlite / React 18 / TypeScript / Tailwind CSS / Framer Motion / Lucide React

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/src/db.rs` | Add `get_all_operation_logs` |
| `src-tauri/src/commands.rs` | Add `get_operation_logs` command |
| `src-tauri/src/lib.rs` | Register new command in `invoke_handler!` |
| `src/types/index.ts` | Add `OperationLog` type; add `'operations'` to `NavPage` |
| `src/mappers/index.ts` | Add `OperationLogDto` interface + `mapOperationLogDto` |
| `src/api.ts` | Add `getOperationLogs` function |
| `src/pages/OperationsPage.tsx` | New page component |
| `src/pages/OperationsPage.test.ts` | New test file |
| `src/components/Sidebar.tsx` | Add Operations nav item |
| `src/App.tsx` | Add state, fetch, render for operations |

---

## Task 1: Backend — DB function and Tauri command

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `get_all_operation_logs` to `db.rs`**

Open `src-tauri/src/db.rs`. Find `pub fn get_all_backups` for reference style, then add after it:

```rust
pub fn get_all_operation_logs(conn: &Connection) -> SqlResult<Vec<OperationLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, operation_type, status, target_type, target_id, target_path,
                preview_json, result_json, backup_id, created_at, completed_at
         FROM operations
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(OperationLog {
            id: row.get(0)?,
            operation_type: row.get(1)?,
            status: row.get(2)?,
            target_type: row.get(3)?,
            target_id: row.get(4)?,
            target_path: row.get(5)?,
            preview_json: row.get(6)?,
            result_json: row.get(7)?,
            backup_id: row.get(8)?,
            created_at: row.get(9)?,
            completed_at: row.get(10)?,
        })
    })?;
    rows.collect()
}
```

- [ ] **Step 2: Add a test for `get_all_operation_logs` inside the `#[cfg(test)]` block in `db.rs`**

In the same test module created in the performance plan (or add a new `#[cfg(test)]` block):

```rust
#[test]
fn get_all_operation_logs_returns_rows_newest_first() {
    let conn = Connection::open_in_memory().unwrap();
    create_tables(&conn).unwrap();
    run_migrations(&conn).unwrap();

    conn.execute(
        "INSERT INTO operations (id, operation_type, status, target_type, target_path, preview_json, result_json, created_at)
         VALUES ('op1', 'delete', 'completed', 'Skill', '/path/a', '{}', '{}', '2026-06-13T08:00:00Z')",
        [],
    ).unwrap();
    conn.execute(
        "INSERT INTO operations (id, operation_type, status, target_type, target_path, preview_json, result_json, created_at)
         VALUES ('op2', 'restore', 'completed', 'Backup', '/path/b', '{}', '{}', '2026-06-13T09:00:00Z')",
        [],
    ).unwrap();

    let logs = get_all_operation_logs(&conn).unwrap();

    assert_eq!(logs.len(), 2);
    // newest first
    assert_eq!(logs[0].id, "op2");
    assert_eq!(logs[1].id, "op1");
    assert_eq!(logs[0].operation_type, "restore");
}
```

- [ ] **Step 3: Run the test to confirm it fails (table may not exist in migration yet)**

```bash
cd src-tauri && cargo test db_tests::get_all_operation_logs_returns_rows_newest_first -- --nocapture
```

If the `operations` table doesn't exist in the in-memory DB's migration, add it. Check `db.rs` `run_migrations` — the `operations` table is created in the settings migration block (around line 300). Confirm `create_tables` includes it; if not, add:

```sql
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
```

to `create_tables` in `db.rs`.

- [ ] **Step 4: Run test again — expect PASS**

```bash
cd src-tauri && cargo test db_tests::get_all_operation_logs_returns_rows_newest_first -- --nocapture
```

Expected: PASS

- [ ] **Step 5: Add `get_operation_logs` command to `commands.rs`**

Add after `get_backups`:

```rust
#[tauri::command]
pub fn get_operation_logs() -> ApiResponse<Vec<db::OperationLog>> {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(e) => return ApiResponse::err(e.to_string()),
    };
    match db::get_all_operation_logs(&conn) {
        Ok(logs) => ApiResponse::ok(logs),
        Err(e) => ApiResponse::err(e.to_string()),
    }
}
```

- [ ] **Step 6: Register the command in `lib.rs`**

Open `src-tauri/src/lib.rs`. Find `tauri::generate_handler![...]`. Add `commands::get_operation_logs` to the list alongside the other commands.

- [ ] **Step 7: Build to verify**

```bash
cd src-tauri && cargo build 2>&1 | head -30
```

Expected: `Finished` with no errors.

- [ ] **Step 8: Run all backend tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add get_operation_logs Tauri command"
```

---

## Task 2: Frontend Type, Mapper, and API

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mappers/index.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Add `OperationLog` type and `'operations'` to `NavPage` in `src/types/index.ts`**

Find the `NavPage` type and add `'operations'`:

```typescript
export type NavPage = 'overview' | 'assets' | 'platforms' | 'models' | 'scan' | 'backups' | 'operations' | 'settings';
```

Add the `OperationLog` interface (after `Backup`):

```typescript
export interface OperationLog {
  id: string;
  operationType: string;
  status: string;
  targetType: string;
  targetId: string | null;
  targetPath: string | null;
  previewJson: string;
  resultJson: string;
  backupId: string | null;
  createdAt: string;
  completedAt: string | null;
}
```

- [ ] **Step 2: Add DTO and mapper to `src/mappers/index.ts`**

Add after the `BackupDto` / `mapBackupDto` section:

```typescript
export interface OperationLogDto {
  id: string;
  operation_type: string;
  status: string;
  target_type: string;
  target_id: string | null;
  target_path: string | null;
  preview_json: string;
  result_json: string;
  backup_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export function mapOperationLogDto(dto: OperationLogDto): OperationLog {
  return {
    id: dto.id,
    operationType: dto.operation_type,
    status: dto.status,
    targetType: dto.target_type,
    targetId: dto.target_id,
    targetPath: dto.target_path,
    previewJson: dto.preview_json,
    resultJson: dto.result_json,
    backupId: dto.backup_id,
    createdAt: dto.created_at,
    completedAt: dto.completed_at,
  };
}
```

Add `OperationLog` to the imports at the top of `mappers/index.ts`:

```typescript
import type { ..., OperationLog } from '../types';
```

- [ ] **Step 3: Add `getOperationLogs` to `src/api.ts`**

Add the import for `OperationLogDto` and `mapOperationLogDto` to the existing mapper import block at the top. Then add after `getBackups`:

```typescript
export async function getOperationLogs(): Promise<OperationLog[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const dtos = await invokeCmd<OperationLogDto[]>('get_operation_logs');
  return dtos.map(mapOperationLogDto);
}
```

- [ ] **Step 4: Run frontend tests to confirm no regressions**

```bash
npm test
```

Expected: all existing tests pass. TypeScript compilation must succeed.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/mappers/index.ts src/api.ts
git commit -m "feat: add OperationLog type, mapper, and getOperationLogs API"
```

---

## Task 3: OperationsPage Component

**Files:**
- Create: `src/pages/OperationsPage.tsx`
- Create: `src/pages/OperationsPage.test.ts`

- [ ] **Step 1: Create `src/pages/OperationsPage.test.ts` with logic tests first**

```typescript
import { describe, it, expect } from 'vitest';
import {
  getOperationTypeLabel,
  isOperationComplete,
} from './OperationsPage';
import type { OperationLog } from '../types';

describe('getOperationTypeLabel', () => {
  it('maps delete to 删除', () => {
    expect(getOperationTypeLabel('delete')).toBe('删除');
  });
  it('maps restore to 还原', () => {
    expect(getOperationTypeLabel('restore')).toBe('还原');
  });
  it('maps install-asset to 安装', () => {
    expect(getOperationTypeLabel('install-asset')).toBe('安装');
  });
  it('maps apply-model-profile to 应用模型配置', () => {
    expect(getOperationTypeLabel('apply-model-profile')).toBe('应用模型配置');
  });
  it('returns raw value for unknown type', () => {
    expect(getOperationTypeLabel('unknown-op')).toBe('unknown-op');
  });
});

describe('isOperationComplete', () => {
  it('returns true for completed status', () => {
    const log = { status: 'completed' } as OperationLog;
    expect(isOperationComplete(log)).toBe(true);
  });
  it('returns true for failed status', () => {
    const log = { status: 'failed' } as OperationLog;
    expect(isOperationComplete(log)).toBe(true);
  });
  it('returns false for running status', () => {
    const log = { status: 'running' } as OperationLog;
    expect(isOperationComplete(log)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A5 "OperationsPage"
```

Expected: FAIL with "Cannot find module './OperationsPage'"

- [ ] **Step 3: Create `src/pages/OperationsPage.tsx`**

```tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { History, Clock, ChevronDown } from 'lucide-react';
import Badge from '../components/Badge';
import { formatDate } from '../utils';
import type { OperationLog } from '../types';

interface OperationsPageProps {
  operationLogs: OperationLog[];
}

const OP_LABELS: Record<string, string> = {
  delete: '删除',
  disable: '禁用',
  'install-asset': '安装',
  'install-asset-batch': '批量安装',
  restore: '还原',
  'apply-model-profile': '应用模型配置',
};

export function getOperationTypeLabel(type: string): string {
  return OP_LABELS[type] ?? type;
}

export function isOperationComplete(log: OperationLog): boolean {
  return log.status === 'completed' || log.status === 'failed';
}

function statusBadge(status: string) {
  if (status === 'completed') return <Badge status="enabled" />;
  if (status === 'failed') return <Badge status="needs-review" />;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      进行中
    </span>
  );
}

export default function OperationsPage({ operationLogs }: OperationsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">操作历史</h2>
        <p className="mt-1 text-sm text-gray-500">所有资产操作的完整记录</p>
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">操作类型</th>
                <th className="px-5 py-3 font-medium">目标类型</th>
                <th className="px-5 py-3 font-medium">目标路径</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">备份</th>
              </tr>
            </thead>
            <tbody>
              {operationLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedId(selectedId === log.id ? null : log.id)}
                  className={`table-row-hover cursor-pointer border-t border-gray-50 ${selectedId === log.id ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-5 py-3 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="whitespace-nowrap">{formatDate(log.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {getOperationTypeLabel(log.operationType)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{log.targetType}</td>
                  <td className="px-5 py-3">
                    <code className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600">
                      {log.targetPath ?? '—'}
                    </code>
                  </td>
                  <td className="px-5 py-3">{statusBadge(log.status)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">
                    {log.backupId ? log.backupId.slice(0, 8) + '...' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {operationLogs.length === 0 && (
          <div className="p-10 text-center text-gray-400">
            <History className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm">暂无操作记录。执行资产操作后会自动记录。</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedId && (() => {
          const log = operationLogs.find((l) => l.id === selectedId);
          if (!log) return null;
          return (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="section-card overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h3 className="font-semibold text-gray-900">操作详情</h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-gray-500">操作 ID</span>
                  <span className="font-mono text-gray-700">{log.id}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-gray-500">目标路径</span>
                  <code className="font-mono text-gray-700">{log.targetPath ?? '—'}</code>
                </div>
                {log.backupId && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <span className="text-gray-500">关联备份 ID</span>
                    <span className="font-mono text-gray-700">{log.backupId}</span>
                  </div>
                )}
                {log.completedAt && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <span className="text-gray-500">完成时间</span>
                    <span className="text-gray-700">{formatDate(log.completedAt)}</span>
                  </div>
                )}
                <div className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-1 text-xs text-gray-400">结果 (JSON)</div>
                  <pre className="overflow-x-auto text-xs text-gray-600">{log.resultJson}</pre>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A10 "OperationsPage"
```

Expected: all `OperationsPage` tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass (17 existing + new OperationsPage tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/OperationsPage.tsx src/pages/OperationsPage.test.ts
git commit -m "feat: add OperationsPage with operation type labels and detail expand"
```

---

## Task 4: Wire OperationsPage into App

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Operations nav item to `src/components/Sidebar.tsx`**

Open `src/components/Sidebar.tsx`. Find the nav items array (it contains objects like `{ id: 'backups', label: '备份', icon: Archive }`). Add after the `backups` entry:

```tsx
{ id: 'operations' as NavPage, label: '操作历史', icon: History },
```

Add `History` to the lucide-react import at the top of the file:

```tsx
import { ..., History } from 'lucide-react';
```

- [ ] **Step 2: Add `operationLogs` state and fetch to `src/App.tsx`**

In `App.tsx`, find where `backups` state is declared. Add alongside it:

```tsx
const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
```

Add `OperationLog` to the types import at the top.

In the `loadData` function (or wherever `getBackups()` is called), add:

```tsx
const logs = await api.getOperationLogs();
setOperationLogs(logs);
```

- [ ] **Step 3: Render `OperationsPage` in the page switch in `App.tsx`**

Find where `<BackupsPage .../>` is rendered (inside a switch/conditional on `currentPage`). Add alongside it:

```tsx
{currentPage === 'operations' && (
  <OperationsPage operationLogs={operationLogs} />
)}
```

Add the import at the top of `App.tsx`:

```tsx
import OperationsPage from './pages/OperationsPage';
```

- [ ] **Step 4: Run frontend tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "feat: wire OperationsPage into nav and app data flow"
```
