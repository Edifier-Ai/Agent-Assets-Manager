import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Box } from 'lucide-react';
import AssetCard from '../../components/AssetCard';
import AssetCardSkeleton from '../../components/AssetCardSkeleton';
import AssetTableView from '../../components/AssetTableView';
import AssetTableSkeleton from '../../components/AssetTableSkeleton';
import AssetDetailPanel from '../../components/AssetDetailPanel';
import AssetToolbar from '../../components/AssetToolbar';
import SelectionBatchBar from '../../components/SelectionBatchBar';
import PreviewModal from '../../components/PreviewModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import ProgressOverlay from '../../components/ProgressOverlay';
import { useToast } from '../../components/Toast';
import { useAssetOperations } from '../../hooks/useAssetOperations';
import { useSkillSelection } from '../../hooks/useSkillSelection';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { matchesAssetFilter, groupAssetsByType, assetMatchesSearch } from './logic';
import { platformTargets } from './constants';
import type { PlatformTarget } from './constants';
import type { Asset, AssetFilterId, Platform } from '../../types';

interface AssetsPageProps {
  assets: Asset[];
  platforms?: Platform[];
  initialFilter?: AssetFilterId;
  initialLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

export default function AssetsPage({ assets, platforms = [], initialFilter = 'all', initialLoading = false, onRefresh }: AssetsPageProps) {
  const [activeFilter, setActiveFilter] = useState<AssetFilterId>(initialFilter);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  const [sourcePlatformId, setSourcePlatformId] = useState<string | undefined>(undefined);
  const { showToast } = useToast();
  const narrow = useMediaQuery('(max-width: 900px)');

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  const filteredAssets = useMemo(
    () => assets.filter((asset) => matchesAssetFilter(asset, activeFilter) && assetMatchesSearch(asset, query)),
    [activeFilter, assets, query],
  );

  const groupedAssets = useMemo(() => groupAssetsByType(filteredAssets), [filteredAssets]);

  const availablePlatformTargets = useMemo<PlatformTarget[]>(() => {
    const activePlatforms = platforms
      .filter((platform) => platform.status === 'active')
      .map((platform) => ({
        id: platform.id,
        name: platform.name,
        kind: platform.kind,
        configRoots: platform.configRoots,
        writable: platform.writable,
        status: platform.status,
      }));
    return activePlatforms.length > 0 ? activePlatforms : platformTargets;
  }, [platforms]);

  useEffect(() => {
    if (availablePlatformTargets.length === 0) {
      setSourcePlatformId(undefined);
      return;
    }
    setSourcePlatformId((current) => (
      current && availablePlatformTargets.some((platform) => platform.id === current)
        ? current
        : availablePlatformTargets[0].id
    ));
  }, [availablePlatformTargets]);

  const detailAsset = selectedAsset && filteredAssets.some((asset) => asset.id === selectedAsset.id)
    ? selectedAsset
    : narrow
      ? null
      : filteredAssets[0] ?? null;

  const {
    preview,
    busyKey,
    progress,
    pendingDestructive,
    showPreview,
    handleInstallClick,
    handleConfirm,
    clearPreview,
    confirmDestructive,
    cancelDestructive,
    handleBatchInstall,
  } = useAssetOperations({ availablePlatformTargets, showToast, onRefresh });

  const {
    isSelectionMode,
    selectedIds,
    selectedSkills,
    selectCount,
    totalSkillCount,
    allSelected,
    toggleSelectionMode,
    exitSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
  } = useSkillSelection(filteredAssets);

  const handleBatchAction = (action: import('../../components/SelectionBatchBar').BatchAction) => {
    if (action === 'install-all') {
      handleBatchInstall(selectedSkills, 'install-all');
    } else if (action === 'sync-from-source') {
      handleBatchInstall(selectedSkills, 'sync-from-source', sourcePlatformId);
    }
  };

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AssetToolbar
          assets={assets}
          query={query}
          onQueryChange={setQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          selectionCount={selectCount}
          selectionTotal={totalSkillCount}
        />

        {isSelectionMode && (
          <SelectionBatchBar
            selectedSkills={selectedSkills}
            selectCount={selectCount}
            totalSkillCount={totalSkillCount}
            allSelected={allSelected}
            availablePlatformTargets={availablePlatformTargets}
            sourcePlatformId={sourcePlatformId}
            onSourcePlatformChange={setSourcePlatformId}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onExitSelectionMode={exitSelectionMode}
            onBatchAction={handleBatchAction}
            busy={!!busyKey}
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {initialLoading ? (
            viewMode === 'cards' ? <AssetCardSkeleton count={6} /> : <AssetTableSkeleton rows={8} />
          ) : viewMode === 'cards' ? (
            <div className="space-y-5">
              {groupedAssets.map((group) => (
                <section key={group.id} className="min-w-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 whitespace-nowrap">{group.label}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {group.assets.length}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                    {group.assets.map((asset, index) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        index={index}
                        isSelected={detailAsset?.id === asset.id}
                        isSelectionMode={isSelectionMode}
                        isChecked={isSelected(asset.id)}
                        onSelect={setSelectedAsset}
                        onToggleCheck={toggleSelect}
                        onInstallClick={handleInstallClick}
                        onShowPreview={showPreview}
                        busyKey={busyKey}
                        availablePlatformTargets={availablePlatformTargets}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <AssetTableView
              assets={filteredAssets}
              detailAssetId={detailAsset?.id ?? null}
              isSelectionMode={isSelectionMode}
              checkedIds={selectedIds}
              onSelectAsset={setSelectedAsset}
              onToggleCheck={toggleSelect}
              onInstallClick={handleInstallClick}
              onShowPreview={showPreview}
              busyKey={busyKey}
              availablePlatformTargets={availablePlatformTargets}
            />
          )}

          {!initialLoading && filteredAssets.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              <Box className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm">没有符合条件的资产</p>
            </div>
          )}
        </div>
      </div>

      <AssetDetailPanel
        asset={detailAsset}
        onClearSelection={() => setSelectedAsset(null)}
        onInstallClick={handleInstallClick}
        onShowPreview={showPreview}
        availablePlatformTargets={availablePlatformTargets}
        narrow={narrow}
      />

      <AnimatePresence>
        {progress && !preview && (
          <div className="fixed bottom-6 right-6 z-40 w-72">
            <ProgressOverlay
              label="正在执行操作..."
              current={progress.current}
              total={progress.total}
            />
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!pendingDestructive}
        title={pendingDestructive?.operation === 'delete' ? '确认回收' : '确认禁用'}
        description={
          pendingDestructive?.operation === 'delete'
            ? `此操作将把「${pendingDestructive?.asset.name ?? ''}」移入回收站。已自动创建备份，可从备份页恢复。`
            : `此操作将从活跃配置中移除「${pendingDestructive?.asset.name ?? ''}」。已自动创建备份。`
        }
        confirmLabel={pendingDestructive?.operation === 'delete' ? '移入回收站' : '禁用'}
        variant={pendingDestructive?.operation === 'delete' ? 'danger' : 'warning'}
        onConfirm={() => { void confirmDestructive(); }}
        onCancel={cancelDestructive}
      />

      {preview && (
        <PreviewModal
          preview={preview}
          onClose={clearPreview}
          onConfirm={() => { void handleConfirm(); }}
        />
      )}
    </div>
  );
}
