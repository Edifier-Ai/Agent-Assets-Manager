import { motion } from 'framer-motion';
import { Ban, Box, CheckSquare, Square, Trash2 } from 'lucide-react';
import Badge from './Badge';
import PlatformInstallButtons from './PlatformInstallButtons';
import PlatformConsistencyMatrix from './PlatformConsistencyMatrix';
import { formatDate, getAssetTypeLabel } from '../utils';
import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';

interface AssetTableViewProps {
  assets: Asset[];
  detailAssetId: string | null;
  isSelectionMode: boolean;
  checkedIds: Set<string>;
  onSelectAsset: (asset: Asset) => void;
  onToggleCheck: (asset: Asset) => void;
  onInstallClick: (asset: Asset, target?: PlatformTarget) => void;
  onShowPreview: (asset: Asset, operation: string) => void;
  busyKey: string | null;
  availablePlatformTargets: PlatformTarget[];
}

export default function AssetTableView({
  assets,
  detailAssetId,
  isSelectionMode,
  checkedIds,
  onSelectAsset,
  onToggleCheck,
  onInstallClick,
  onShowPreview,
  busyKey,
  availablePlatformTargets,
}: AssetTableViewProps) {
  return (
    <div className="section-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              {isSelectionMode && <th className="px-2 py-3 w-8" />}
              <th className="px-5 py-3 font-medium">资产</th>
              <th className="px-5 py-3 font-medium">类型</th>
              <th className="px-5 py-3 font-medium">描述</th>
              <th className="px-5 py-3 font-medium">平台一致性</th>
              <th className="px-5 py-3 font-medium">安装平台</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">风险</th>
              <th className="px-5 py-3 font-medium">修改时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => (
              <motion.tr
                key={asset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className={`table-row-hover cursor-pointer border-t border-gray-50 ${detailAssetId === asset.id ? 'bg-blue-50/50' : ''}`}
                onClick={() => {
                  if (isSelectionMode && asset.type === 'Skill') {
                    onToggleCheck(asset);
                  } else {
                    onSelectAsset(asset);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isSelectionMode && asset.type === 'Skill') {
                      onToggleCheck(asset);
                    } else {
                      onSelectAsset(asset);
                    }
                  }
                }}
                tabIndex={0}
              >
                {isSelectionMode && (
                  <td className="px-2 py-3">
                    {asset.type === 'Skill' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCheck(asset);
                        }}
                        className="text-blue-600"
                      >
                        {checkedIds.has(asset.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    )}
                  </td>
                )}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-100">
                      <Box className="h-3 w-3 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap">{asset.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {getAssetTypeLabel(asset.type)}
                  </span>
                </td>
                <td className="max-w-xs truncate px-5 py-3 text-gray-600">{asset.description}</td>
                <td className="px-5 py-3">
                  {asset.type === 'Skill' && (
                    <PlatformConsistencyMatrix
                      asset={asset}
                      availablePlatformTargets={availablePlatformTargets}
                      compact
                    />
                  )}
                </td>
                <td className="px-5 py-3">
                  <PlatformInstallButtons
                    asset={asset}
                    availablePlatformTargets={availablePlatformTargets}
                    onInstallClick={onInstallClick}
                    compact
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {asset.status.slice(0, 2).map((status) => (
                      <Badge key={status} status={status} />
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge risk={asset.riskLevel} />
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(asset.updatedAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void onShowPreview(asset, 'disable');
                      }}
                      disabled={busyKey === `disable:${asset.id}:primary`}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title="禁用"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void onShowPreview(asset, 'delete');
                      }}
                      disabled={busyKey === `delete:${asset.id}:primary`}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="移入回收站"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
