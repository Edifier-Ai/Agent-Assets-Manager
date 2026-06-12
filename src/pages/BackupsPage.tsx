import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive, RotateCcw, Clock, CheckCircle2
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { backups } from '../data/mockData';
import { formatDate } from '../utils';

export default function BackupsPage() {
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleRestore = (id: string) => {
    setRestoring(id);
    setTimeout(() => {
      const backup = backups.find(b => b.id === id);
      showToast(`已恢复备份：${backup?.originalPath || id}`, 'success');
      setRestoring(null);
      setSelectedBackup(null);
    }, 2000);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">备份</h2>
          <p className="text-sm text-gray-500 mt-1">查看操作备份与恢复</p>
        </div>

        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">备份时间</th>
                  <th className="px-5 py-3 font-medium">操作类型</th>
                  <th className="px-5 py-3 font-medium">原始路径</th>
                  <th className="px-5 py-3 font-medium">备份路径</th>
                  <th className="px-5 py-3 font-medium">Hash</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.id}
                    className={`table-row-hover cursor-pointer border-t border-gray-50 ${selectedBackup === backup.id ? 'bg-blue-50/50' : ''}`}
                    onClick={() => setSelectedBackup(selectedBackup === backup.id ? null : backup.id)}
                  >
                    <td className="px-5 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(backup.createdAt)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {backup.operationType === 'disable' ? '禁用' : backup.operationType === 'config-change' ? '配置变更' : backup.operationType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{backup.originalPath}</code>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">{backup.backupPath}</code>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-gray-400">{backup.hash.slice(0, 8)}...</span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(backup.id); }}
                        disabled={restoring === backup.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {restoring === backup.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            已恢复
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            恢复
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {backups.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">暂无备份记录</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedBackup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="section-card overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">备份详情</h3>
              </div>
              <div className="p-5 space-y-3 text-sm">
                {(() => {
                  const b = backups.find(x => x.id === selectedBackup);
                  if (!b) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-gray-500">操作 ID</span>
                        <span className="font-mono text-gray-700">{b.operationId}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-gray-500">原始路径</span>
                        <code className="font-mono text-gray-700">{b.originalPath}</code>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-gray-500">备份路径</span>
                        <code className="font-mono text-gray-700">{b.backupPath}</code>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-gray-500">内容哈希</span>
                        <span className="font-mono text-gray-700">{b.hash}</span>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => handleRestore(b.id)}
                          disabled={restoring === b.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {restoring === b.id ? '正在恢复...' : '恢复此备份'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
