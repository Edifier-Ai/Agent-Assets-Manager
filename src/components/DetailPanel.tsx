import { X, Copy, FolderOpen, CheckCircle, Pencil, Shield, Eye } from 'lucide-react';
import type { Platform } from '../types';

interface DetailPanelProps {
  platform: Platform | null;
  onClose: () => void;
}

export default function DetailPanel({ platform, onClose }: DetailPanelProps) {
  if (!platform) {
    return (
      <div className="detail-panel w-80 p-6 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Pencil className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm">选择一个平台或资产<br/>查看详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-panel w-80 flex flex-col">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{platform.name[0]}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{platform.name}Adapter</h3>
            <p className="text-xs text-gray-400">{platform.kind}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Copy className="w-3.5 h-3.5" />
            CLI 路径
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg break-all">
              {platform.cliPath}
            </code>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <FolderOpen className="w-3.5 h-3.5" />
            配置根目录
          </div>
          <div className="space-y-1.5">
            {platform.configRoots.map((root, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg break-all">
                  {root}
                </code>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors border border-gray-200">
            <FolderOpen className="w-3.5 h-3.5" />
            在 Finder 中显示
          </button>
        </div>
        
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
            可写状态：{platform.writable === 'writable' ? '可写' : platform.writable === 'readonly' ? '只读' : '部分可写'}
          </div>
          <p className="text-xs text-gray-500">
            {platform.writable === 'partial' && '部分配置根目录为只读'}
            {platform.writable === 'writable' && '所有配置均可写入'}
            {platform.writable === 'readonly' && '当前配置不可写入'}
          </p>
        </div>
        
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            安全操作
          </div>
          <div className="space-y-1.5">
            {platform.safeActions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                {action}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            需要预览
          </div>
          <div className="space-y-1.5">
            {platform.previewRequiredActions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500" />
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
