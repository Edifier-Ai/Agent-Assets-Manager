# Feature Completion: Operation History Design

> **For agentic workers:** After this spec is approved, invoke writing-plans to create the implementation plan.

**Goal:** Surface the `operations` table (already populated on every execute) as a visible Operations page in the UI, giving users a persistent audit trail of every delete, disable, install, and restore action.

**Architecture:** Add one Tauri command (`get_operation_logs`), one frontend type + mapper, one new page (`OperationsPage`), and wire it into the existing nav. The `operations` table schema is already complete — this is pure read-path work plus UI.

**Tech Stack:** Rust / rusqlite (read-only) / React + TypeScript / Tailwind CSS

---

## Backend: `get_operation_logs` Command

### Current state

`db.rs:84-97` defines `OperationLog`. The `operations` table is created in the migration at `db.rs:300-312`. `operations.rs` inserts a row on every `execute_operation` call. No Tauri command exposes this data.

### New command

```rust
// src-tauri/src/commands.rs
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

Register it in `lib.rs` alongside the existing commands.

### New DB function

```rust
// src-tauri/src/db.rs
pub fn get_all_operation_logs(conn: &Connection) -> SqlResult<Vec<OperationLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, operation_type, status, target_type, target_id, target_path,
                preview_json, result_json, backup_id, created_at, completed_at
         FROM operations
         ORDER BY created_at DESC"
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

---

## Frontend Type and Mapper

### New type in `src/types/index.ts`

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

### New DTO + mapper in `src/mappers/index.ts`

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

### New API function in `src/api.ts`

```typescript
export async function getOperationLogs(): Promise<OperationLog[]> {
  if (!isTauriRuntime()) return [];
  const dtos = await invokeCmd<OperationLogDto[]>('get_operation_logs');
  return dtos.map(mapOperationLogDto);
}
```

---

## Frontend: OperationsPage

### File: `src/pages/OperationsPage.tsx`

Layout matches existing pages: full-width table, empty state, detail expand-on-click.

**Columns:** 时间 / 操作类型 / 目标类型 / 目标路径 / 状态 / 关联备份

**Operation type display labels:**
```typescript
const OP_LABELS: Record<string, string> = {
  'delete': '删除',
  'disable': '禁用',
  'install-asset': '安装',
  'install-asset-batch': '批量安装',
  'restore': '还原',
  'apply-model-profile': '应用模型配置',
};
```

**Status badge:** reuse existing `Badge` component:
- `'completed'` → `status="enabled"` (green)
- `'failed'` → `status="needs-review"` (amber)
- `'running'` → show spinner

**Empty state:**
```tsx
<div className="p-10 text-center text-gray-400">
  <History className="mx-auto mb-2 h-8 w-8 text-gray-300" />
  <p className="text-sm">暂无操作记录。执行资产操作后会自动记录。</p>
</div>
```

**Detail expand:** clicking a row expands an inline panel showing `target_path`, `backup_id` (linked to BackupsPage if non-null), and the raw `result_json` in a `<pre>` block for debugging.

### Props

```typescript
interface OperationsPageProps {
  operationLogs: OperationLog[];
  onNavigate: (page: NavPage) => void;
}
```

---

## Nav Integration

### `src/types/index.ts` — add to `NavPage` union

```typescript
export type NavPage = 'overview' | 'assets' | 'platforms' | 'models' | 'scan' | 'backups' | 'operations' | 'settings';
```

### `src/components/Sidebar.tsx` — add nav item

Add after the `backups` entry:

```tsx
{ id: 'operations', label: '操作历史', icon: History }
```

`History` is from `lucide-react`.

### `src/App.tsx` — wire data and page

1. Add `operationLogs` to app state alongside `backups`.
2. Fetch via `api.getOperationLogs()` in the existing `loadData()` function.
3. Render `<OperationsPage operationLogs={operationLogs} onNavigate={handleNavigate} />` in the page switch.

---

## Data Loading

In `App.tsx`, `loadData()` already fetches backups, assets, platforms etc. Add:

```typescript
const logs = await api.getOperationLogs();
setOperationLogs(logs);
```

No separate refresh needed — `onRefresh` in `OperationsPage` calls the parent `onRefresh` prop, same pattern as `BackupsPage`.

---

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/db.rs` | Add `get_all_operation_logs` |
| `src-tauri/src/commands.rs` | Add `get_operation_logs` command |
| `src-tauri/src/lib.rs` | Register new command |
| `src/types/index.ts` | Add `OperationLog` type, add `'operations'` to `NavPage` |
| `src/mappers/index.ts` | Add `OperationLogDto` and `mapOperationLogDto` |
| `src/api.ts` | Add `getOperationLogs` |
| `src/pages/OperationsPage.tsx` | New file |
| `src/components/Sidebar.tsx` | Add nav item |
| `src/App.tsx` | Wire state, fetch, render |

---

## Out of Scope

- Pagination (operations table expected to stay small — < 500 rows for typical use)
- Filtering by date range or operation type (can be added later)
- Deleting operation history
- Exporting to CSV
