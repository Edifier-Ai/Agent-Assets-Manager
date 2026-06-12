import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box, ChevronDown, Trash2, Ban, Copy
} from 'lucide-react';
import Badge from '../components/Badge';
import PreviewModal from '../components/PreviewModal';
import { assets } from '../data/mockData';
import { formatDate, getAssetTypeLabel } from '../utils';
import type { Asset, OperationPreview } from '../types';

const filters = [
  { id: 'all', label: '全部' },
  { id: 'Skill', label: 'Skills' },
  { id: 'Agent', label: 'Agents' },
  { id: 'Command', label: 'Commands' },
  { id: 'MCP Server', label: 'MCP' },
  { id: 'Model Config', label: 'Models' },
  { id: 'needs-review', label: '需要检查' },
  { id: 'duplicate', label: '重复项' },
  { id: 'conflict', label: '冲突' },
  { id: 'high', label: '风险' },
  { id: 'project-local', label: '项目本地' },
];

import { useToast } from '../components/Toast';

export default function AssetsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const { showToast } = useToast();

  const filteredAssets = useMemo(() => {
    if (activeFilter === 'all') return assets;
    if (activeFilter === 'needs-review') return assets.filter(a => a.status.includes('needs-review'));
    if (activeFilter === 'duplicate') return assets.filter(a => a.status.includes('duplicate'));
    if (activeFilter === 'conflict') return assets.filter(a => a.status.includes('conflict'));
    if (activeFilter === 'high') return assets.filter(a => a.riskLevel === 'high');
    if (activeFilter === 'project-local') return assets.filter(a => a.status.includes('project-local'));
    return assets.filter(a => a.type === activeFilter);
  }, [activeFilter]);

  const showPreview = (asset: Asset, operation: string) => {
    const isSupported = asset.installations.some(i => i.platformName === 'OpenCode' || i.platformName === 'OpenClaw');
    setPreview({
      operationType: operation,
      targetName: asset.name,
      targetType: asset.type,
      modifiedFiles: asset.installations.map(i => i.path),
      writtenKeys: operation === 'disable' ? ['enabled'] : operation === 'delete' ? [] : ['config'],
      needsBackup: true,
      needsRestart: false,
      risks: asset.riskLevel === 'high' ? ['资产标记为高风险，包含可执行脚本'] : [],
      supported: isSupported,
    });
  };

  const handleConfirm = () => {
    if (preview) {
      showToast(`${preview.operationType === 'disable' ? '禁用' : '移入回收站'}操作已执行：${preview.targetName}`, 'success');
      setPreview(null);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`filter-chip ${activeFilter === f.id ? 'active' : 'bg-gray-50 text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="section-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">资产</th>
                    <th className="px-5 py-3 font-medium">类型</th>
                    <th className="px-5 py-3 font-medium">描述</th>
                    <th className="px-5 py-3 font-medium">来源</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">风险</th>
                    <th className="px-5 py-3 font-medium">修改时间</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset, index) => (
                    <motion.tr
                      key={asset.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`table-row-hover cursor-pointer border-t border-gray-50 ${selectedAsset?.id === asset.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-100">
                            <Box className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          {getAssetTypeLabel(asset.type)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{asset.description}</td>
                      <td className="px-5 py-3 text-gray-600">{asset.source}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {asset.status.slice(0, 2).map((s, i) => (
                            <Badge key={i} status={s} />
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge risk={asset.riskLevel} />
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(asset.updatedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); showPreview(asset, 'disable'); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="禁用"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); showPreview(asset, 'delete'); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="移入回收站"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredAssets.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                <Box className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">没有符合条件的资产</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAsset && (
        <div className="w-72 bg-white border-l border-gray-100 overflow-y-auto p-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">资产详情</h3>
            <button
              onClick={() => setSelectedAsset(null)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">名称</div>
              <div className="font-medium text-gray-900">{selectedAsset.name}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">类型</div>
              <div className="font-mono text-gray-700">{getAssetTypeLabel(selectedAsset.type)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">描述</div>
              <div className="text-gray-700">{selectedAsset.description}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">作者</div>
              <div className="text-gray-700">{selectedAsset.author}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">版本</div>
              <div className="text-gray-700">{selectedAsset.version}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">状态</div>
              <div className="flex flex-wrap gap-1">
                {selectedAsset.status.map((s, i) => (
                  <Badge key={i} status={s} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">安装位置</div>
              <div className="space-y-1.5">
                {selectedAsset.installations.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1.5 rounded break-all">
                      {inst.path}
                    </code>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => showPreview(selectedAsset, 'disable')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                禁用
              </button>
              <button
                onClick={() => showPreview(selectedAsset, 'delete')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                移入回收站
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <PreviewModal
          preview={preview}
          onClose={() => setPreview(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
