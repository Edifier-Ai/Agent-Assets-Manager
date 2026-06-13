import { X, AlertTriangle, FileEdit, RotateCcw, CheckCircle, Ban } from 'lucide-react';
import type { OperationPreview } from '../types';

interface PreviewModalProps {
  preview: OperationPreview;
  onClose: () => void;
  onConfirm?: () => void;
}

export default function PreviewModal({ preview, onClose, onConfirm }: PreviewModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">操作预览</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-500">操作类型</span>
            <span className="text-sm font-medium text-gray-900">{preview.operationType}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-500">目标对象</span>
            <span className="text-sm font-medium text-gray-900">{preview.targetName}（{preview.targetType}）</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-500">目标路径</span>
            <code className="text-xs font-mono text-gray-700">{preview.targetPath}</code>
          </div>

          {preview.sourcePath && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-500">来源路径</span>
              <code className="text-xs font-mono text-gray-700">{preview.sourcePath}</code>
            </div>
          )}
          
          {preview.filesToModify.length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-2 flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5" />
                将修改的文件
              </div>
              <div className="space-y-1">
                {preview.filesToModify.map((file, i) => (
                  <div key={i} className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.filesToMove.length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-2">将移动的文件</div>
              <div className="space-y-1">
                {preview.filesToMove.map((file, i) => (
                  <div key={i} className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {preview.writtenKeys.length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-2">将写入的配置项</div>
              <div className="space-y-1">
                {preview.writtenKeys.map((key, i) => (
                  <div key={i} className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {key}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.backupPaths.length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-2">备份或目标目录</div>
              <div className="space-y-1">
                {preview.backupPaths.map((path, i) => (
                  <div key={i} className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {preview.backupPaths.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-blue-600">
                <RotateCcw className="w-3.5 h-3.5" />
                将创建备份
              </div>
            )}
            {preview.needsRestart && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                需要重启平台
              </div>
            )}
          </div>
          
          {preview.risks.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <div className="text-sm font-medium text-red-700 mb-1">风险提示</div>
              <ul className="space-y-1">
                {preview.risks.map((risk, i) => (
                  <li key={i} className="text-sm text-red-600">• {risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {onConfirm ? '取消' : '关闭'}
          </button>
          {onConfirm && preview.supported ? (
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              确认执行
            </button>
          ) : onConfirm ? (
            <button
              disabled
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed flex items-center gap-2"
            >
              <Ban className="w-4 h-4" />
              当前适配器暂不支持写入
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
