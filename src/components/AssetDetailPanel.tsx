import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Ban, ChevronDown, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import Badge from './Badge';
import PlatformInstallButtons from './PlatformInstallButtons';
import { deriveSource, getAssetTypeLabel } from '../utils';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';

interface AssetDetailPanelProps {
  asset: Asset | null;
  onClearSelection: () => void;
  onInstallClick: (asset: Asset, target?: PlatformTarget) => void;
  onShowPreview: (asset: Asset, operation: string) => void;
  availablePlatformTargets: PlatformTarget[];
  narrow?: boolean;
}

function DetailContent({
  asset,
  onInstallClick,
  onShowPreview,
  availablePlatformTargets,
}: {
  asset: Asset;
  onInstallClick: (asset: Asset, target?: PlatformTarget) => void;
  onShowPreview: (asset: Asset, operation: string) => void;
  availablePlatformTargets: PlatformTarget[];
}) {
  const copy = useCopyToClipboard();
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-blue-700">
            {getAssetTypeLabel(asset.type)}
          </span>
          <Badge risk={asset.riskLevel} />
        </div>
        <div className="mt-2 font-semibold text-gray-900">{asset.name}</div>
        <div className="mt-1 text-xs leading-5 text-gray-600">{asset.description || '暂无描述'}</div>
      </div>

      <div>
        <div className="mb-2 text-gray-500 whitespace-nowrap">安装平台</div>
        <PlatformInstallButtons
          asset={asset}
          availablePlatformTargets={availablePlatformTargets}
          onInstallClick={onInstallClick}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-xs text-gray-400 whitespace-nowrap">版本</div>
          <div className="mt-1 truncate text-gray-800">{asset.version || '未知'}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-xs text-gray-400 whitespace-nowrap">来源</div>
          <div className="mt-1 truncate text-gray-800">{deriveSource(asset)}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-xs text-gray-400 whitespace-nowrap">作者</div>
          <div className="mt-1 truncate text-gray-800">{asset.author || '未知'}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-xs text-gray-400 whitespace-nowrap">范围</div>
          <div className="mt-1 truncate text-gray-800">{asset.installations[0]?.scope === 'project' ? '项目级' : '全局'}</div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-gray-500 whitespace-nowrap">状态</div>
        <div className="flex flex-wrap gap-1">
          {asset.status.map((status) => (
            <Badge key={status} status={status} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-gray-500 whitespace-nowrap">安装位置</div>
        <div className="space-y-1.5">
          {asset.installations.map((installation) => (
            <div key={installation.id} className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700">
                {installation.path}
              </code>
              <button onClick={() => copy(installation.path, '安装路径')} className="rounded p-1.5 text-gray-400 hover:bg-gray-100" title="复制路径">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => onInstallClick(asset)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          <span className="whitespace-nowrap">安装到全部平台</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100">
            <Archive className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">同步所选平台</span>
          </button>
          <button className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100">
            <Pencil className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">编辑</span>
          </button>
          <button
            onClick={() => { void onShowPreview(asset, 'disable'); }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            <Ban className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">禁用</span>
          </button>
          <button
            onClick={() => { void onShowPreview(asset, 'delete'); }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">回收</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssetDetailPanel({
  asset,
  onClearSelection,
  onInstallClick,
  onShowPreview,
  availablePlatformTargets,
  narrow = false,
}: AssetDetailPanelProps) {
  if (narrow) {
    return (
      <AnimatePresence>
        {asset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-10 z-40 bg-black/20"
              onClick={onClearSelection}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 top-10 z-50 w-80 overflow-y-auto border-l border-gray-100 bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 whitespace-nowrap">资产详情</h3>
                <button
                  onClick={onClearSelection}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                  title="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <DetailContent
                asset={asset}
                onInstallClick={onInstallClick}
                onShowPreview={onShowPreview}
                availablePlatformTargets={availablePlatformTargets}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 whitespace-nowrap">资产详情</h3>
        {asset && (
          <button
            onClick={onClearSelection}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
            title="清除选择"
          >
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
        )}
      </div>

      {asset ? (
        <DetailContent
          asset={asset}
          onInstallClick={onInstallClick}
          onShowPreview={onShowPreview}
          availablePlatformTargets={availablePlatformTargets}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
          选择一个资产查看详情
        </div>
      )}
    </aside>
  );
}