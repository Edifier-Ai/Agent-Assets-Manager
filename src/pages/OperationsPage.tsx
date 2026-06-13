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
