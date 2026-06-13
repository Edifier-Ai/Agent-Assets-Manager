import { motion } from 'framer-motion';
import { AlertTriangle, Ban, CheckSquare, Copy, FolderOpen, MoreHorizontal, Square, Trash2 } from 'lucide-react';
import Badge from './Badge';
import DropdownMenu from './DropdownMenu';
import PlatformInstallButtons from './PlatformInstallButtons';
import Tooltip from './Tooltip';
import { deriveSource, deriveSourceDetail, getAssetTypeLabel, getFileName } from '../utils';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { getPrimaryPath } from '../pages/assets/logic';
import { invoke } from '@tauri-apps/api/core';
import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';

interface AssetCardProps {
  asset: Asset;
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  isChecked: boolean;
  onSelect: (asset: Asset) => void;
  onToggleCheck: (asset: Asset) => void;
  onInstallClick: (asset: Asset, target?: PlatformTarget) => void;
  onShowPreview: (asset: Asset, operation: string) => void;
  busyKey: string | null;
  availablePlatformTargets: PlatformTarget[];
}

const warningStatuses = new Set(['needs-review', 'duplicate', 'conflict']);

export default function AssetCard({
  asset,
  index,
  isSelected,
  isSelectionMode,
  isChecked,
  onSelect,
  onToggleCheck,
  onInstallClick,
  onShowPreview,
  busyKey,
  availablePlatformTargets,
}: AssetCardProps) {
  const copy = useCopyToClipboard();
  const primaryPath = getPrimaryPath(asset);
  const source = deriveSource(asset);
  const sourceDetail = deriveSourceDetail(asset);
  const hasWarning = asset.status.some((s) => warningStatuses.has(s));
  const warningLabel = asset.status.filter((s) => warningStatuses.has(s)).map((s) => {
    if (s === 'needs-review') return '需要检查';
    if (s === 'duplicate') return '重复项';
    return '冲突';
  }).join('、');

  const menuItems = [
    {
      label: '复制路径',
      icon: <Copy />,
      onClick: () => { void copy(primaryPath, '路径'); },
    },
    {
      label: '在 Finder 中显示',
      icon: <FolderOpen />,
      onClick: () => { void invoke('plugin:opener|reveal_item_in_dir', { path: primaryPath }); },
    },
    {
      label: '禁用',
      icon: <Ban />,
      onClick: () => { void onShowPreview(asset, 'disable'); },
      disabled: busyKey === `disable:${asset.id}:primary`,
    },
    {
      label: '移入回收站',
      icon: <Trash2 />,
      onClick: () => { void onShowPreview(asset, 'delete'); },
      variant: 'danger' as const,
      disabled: busyKey === `delete:${asset.id}:primary`,
    },
  ];

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      onClick={() => {
        if (isSelectionMode && asset.type === 'Skill') {
          onToggleCheck(asset);
        } else {
          onSelect(asset);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isSelectionMode && asset.type === 'Skill') {
            onToggleCheck(asset);
          } else {
            onSelect(asset);
          }
        }
      }}
      tabIndex={0}
      className={`min-w-0 cursor-pointer rounded-lg border bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 ${
        isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
      }`}
    >
      {/* Header: type + source + warning indicator + menu + checkbox */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {isSelectionMode && asset.type === 'Skill' && (
            <span className="flex items-center justify-center rounded p-0.5 text-blue-600">
              {isChecked ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
            </span>
          )}
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 whitespace-nowrap">
            {getAssetTypeLabel(asset.type)}
          </span>
          <Tooltip content={
            sourceDetail.length > 1 ? (
              <div className="space-y-1">
                <div className="font-medium">安装来源</div>
                {sourceDetail.map((detail, idx) => (
                  <div key={idx} className="text-xs">
                    {detail.platform} · {detail.scope}
                  </div>
                ))}
              </div>
            ) : source
          }>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 whitespace-nowrap truncate max-w-[120px]">
              {source}
            </span>
          </Tooltip>
          {asset.riskLevel === 'high' && <Badge risk="high" />}
        </div>
        <div className="flex items-center gap-0.5">
          {hasWarning && (
            <Tooltip content={warningLabel}>
              <span className="flex items-center justify-center rounded-full p-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </span>
            </Tooltip>
          )}
          <DropdownMenu trigger={<MoreHorizontal className="h-4 w-4" />} items={menuItems} />
        </div>
      </div>

      {/* Name */}
      <h3 className="mt-2 truncate text-sm font-semibold text-gray-900" title={asset.name}>
        {asset.name}
      </h3>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-gray-500">
        {asset.description || '暂无描述'}
      </p>

      {/* Meta row: version + scope */}
      {asset.version && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
          <span>v{asset.version}</span>
          {asset.installations[0]?.scope && (
            <>
              <span className="text-gray-200">·</span>
              <span>{asset.installations[0].scope === 'project' ? '项目级' : '全局'}</span>
            </>
          )}
        </div>
      )}

      {/* Platform install buttons */}
      <div className="mt-3">
        <PlatformInstallButtons
          asset={asset}
          availablePlatformTargets={availablePlatformTargets}
          onInstallClick={onInstallClick}
          compact
        />
      </div>

      {/* Footer: file path (simplified) + date */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <Tooltip content={primaryPath} side="bottom">
          <span className="truncate rounded bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-500 max-w-[180px]">
            {getFileName(primaryPath)}
          </span>
        </Tooltip>
        <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
          {asset.installations.length} 个位置
        </span>
      </div>
    </motion.article>
  );
}
