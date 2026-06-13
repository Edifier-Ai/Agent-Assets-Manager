import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  Ban,
  Box,
  CheckCircle2,
  ChevronDown,
  Copy,
  Filter,
  Grid2X2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Badge from '../components/Badge';
import PlatformIcon from '../components/PlatformIcon';
import PreviewModal from '../components/PreviewModal';
import { useToast } from '../components/Toast';
import * as api from '../api';
import { formatDate, getAssetTypeLabel } from '../utils';
import type { Asset, AssetFilterId, AssetType, OperationPreview, OperationRequest, Platform } from '../types';

interface AssetsPageProps {
  assets: Asset[];
  platforms?: Platform[];
  initialFilter?: AssetFilterId;
  onRefresh?: () => Promise<void>;
}

type AssetGroup = {
  id: AssetType;
  label: string;
  assets: Asset[];
};

type PlatformTarget = {
  id: string;
  name: string;
  kind: string;
  configRoots?: string[];
  writable?: string;
  status?: string;
};

const assetTypeOrder: AssetType[] = [
  'Skill',
  'Agent',
  'Command',
  'MCP Server',
  'Tool',
  'Rule',
  'Memory',
  'Persona',
  'Provider Config',
  'Model Config',
  'CLI Runtime',
];

const platformTargets: PlatformTarget[] = [
  { id: 'codex', name: 'Codex', kind: 'codex' },
  { id: 'claude', name: 'Claude', kind: 'claude' },
  { id: 'kimi', name: 'Kimi', kind: 'kimi' },
  { id: 'gemini', name: 'Gemini', kind: 'gemini' },
  { id: 'cursor', name: 'Cursor', kind: 'cursor' },
  { id: 'qwen', name: 'Qwen', kind: 'qwen' },
];

const assetTypeSubdirByPlatform: Partial<Record<string, Partial<Record<AssetType, string>>>> = {
  cursor: {
    Skill: 'skills-cursor',
    Rule: 'rules',
    Command: 'commands',
  },
  gemini: {
    Rule: '',
    Skill: 'skills',
    Command: 'commands',
  },
};

const defaultAssetTypeSubdirs: Partial<Record<AssetType, string>> = {
  Skill: 'skills',
  Agent: 'agents',
  Command: 'commands',
  'MCP Server': 'mcp',
  Rule: 'rules',
  Memory: 'memories',
  Persona: 'personas',
  'Model Config': 'models',
  'Provider Config': 'providers',
  'CLI Runtime': 'runtimes',
  Tool: 'tools',
};

export const assetFilters: Array<{ id: AssetFilterId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'Skill', label: '技能' },
  { id: 'Agent', label: 'Agent' },
  { id: 'Command', label: '命令' },
  { id: 'MCP Server', label: 'MCP' },
  { id: 'Rule', label: '规则' },
  { id: 'Memory', label: '记忆' },
  { id: 'Persona', label: '人格' },
  { id: 'Model Config', label: '模型配置' },
  { id: 'needs-review', label: '需要检查' },
  { id: 'duplicate', label: '重复项' },
  { id: 'conflict', label: '冲突' },
  { id: 'high', label: '风险' },
  { id: 'project-local', label: '项目本地' },
];

export function matchesAssetFilter(asset: Asset, activeFilter: AssetFilterId): boolean {
  if (activeFilter === 'all') return true;
  if (activeFilter === 'needs-review') return asset.status.includes('needs-review');
  if (activeFilter === 'duplicate') return asset.status.includes('duplicate');
  if (activeFilter === 'conflict') return asset.status.includes('conflict');
  if (activeFilter === 'high') return asset.riskLevel === 'high';
  if (activeFilter === 'project-local') return asset.status.includes('project-local');
  return asset.type === activeFilter;
}

export function groupAssetsByType(assets: Asset[]): AssetGroup[] {
  return assetTypeOrder
    .map((type) => ({
      id: type,
      label: getAssetTypeLabel(type),
      assets: assets.filter((asset) => asset.type === type),
    }))
    .filter((group) => group.assets.length > 0);
}

function normalizePlatform(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function assetMatchesSearch(asset: Asset, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    asset.name,
    asset.description,
    asset.source,
    asset.author,
    asset.version,
    ...asset.installations.flatMap((installation) => [
      installation.platformName,
      installation.path,
      installation.scope,
    ]),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function isInstalledOnPlatform(asset: Asset, target: PlatformTarget): boolean {
  const targetId = normalizePlatform(target.id);
  return asset.installations.some((installation) => {
    const platformId = normalizePlatform(installation.platformId);
    const platformName = normalizePlatform(installation.platformName);
    return platformId.includes(targetId) || platformName.includes(targetId);
  });
}

function getPrimaryPath(asset: Asset): string {
  return asset.installations[0]?.path ?? '未发现安装路径';
}

function getSourcePathForInstall(asset: Asset): string | null {
  const sourcePath = asset.installations[0]?.path;
  if (!sourcePath) return null;

  if ((asset.type === 'Skill' && sourcePath.endsWith('/SKILL.md'))
    || (asset.type === 'Agent' && sourcePath.endsWith('/AGENTS.md'))) {
    return sourcePath.split('/').slice(0, -1).join('/');
  }

  return sourcePath;
}

function sanitizeAssetName(name: string): string {
  return name
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'asset';
}

function extensionForAsset(asset: Asset, sourcePath: string): string {
  const sourceFile = sourcePath.split('/').pop() ?? '';
  const extensionMatch = sourceFile.match(/(\.[a-z0-9]+)$/i);
  if (extensionMatch) return extensionMatch[1];
  if (asset.type === 'MCP Server') return '.json';
  return '.md';
}

function getInstallTargetPath(asset: Asset, platform: PlatformTarget): string | null {
  const root = platform.configRoots?.[0];
  if (!root) return null;

  const sourcePath = getSourcePathForInstall(asset);
  if (!sourcePath) return null;

  const subdir = assetTypeSubdirByPlatform[platform.id]?.[asset.type] ?? defaultAssetTypeSubdirs[asset.type];
  if (subdir === undefined) return null;

  const base = sanitizeAssetName(asset.name);
  const rootPath = root.replace(/\/+$/g, '');
  const parent = subdir ? `${rootPath}/${subdir}` : rootPath;

  if (asset.type === 'Skill' || asset.type === 'Agent') {
    return `${parent}/${base}`;
  }

  return `${parent}/${base}${extensionForAsset(asset, sourcePath)}`;
}

export function buildInstallOperationRequest(asset: Asset, platform: PlatformTarget): OperationRequest | null {
  const sourcePath = getSourcePathForInstall(asset);
  const targetPath = getInstallTargetPath(asset, platform);
  if (!sourcePath || !targetPath) return null;

  return {
    operationType: 'install-asset',
    targetId: asset.id,
    targetName: asset.name,
    targetType: asset.type,
    targetPath,
    sourcePath,
    official: false,
    riskLevel: asset.riskLevel,
    platformId: platform.id,
  };
}

function aggregatePreviews(
  targetName: string,
  previews: OperationPreview[],
  requests: OperationRequest[],
): OperationPreview {
  const unsupported = previews.filter((preview) => !preview.supported);
  return {
    operationType: requests.length > 1 ? 'install-asset-batch' : 'install-asset',
    targetId: requests[0]?.targetId,
    targetName,
    targetType: requests[0]?.targetType ?? 'Asset',
    targetPath: requests.map((request) => request.targetPath).join('\n'),
    sourcePath: requests[0]?.sourcePath,
    filesToModify: previews.flatMap((preview) => preview.filesToModify),
    filesToMove: previews.flatMap((preview) => preview.filesToMove),
    backupPaths: previews.flatMap((preview) => preview.backupPaths),
    writtenKeys: previews.flatMap((preview) => preview.writtenKeys),
    needsRestart: previews.some((preview) => preview.needsRestart),
    risks: unsupported.length > 0
      ? unsupported.flatMap((preview) => preview.risks)
      : [`将安装到 ${requests.length} 个平台，并为已存在的目标创建覆盖前备份。`],
    supported: unsupported.length === 0,
  };
}

export default function AssetsPage({ assets, platforms = [], initialFilter = 'all', onRefresh }: AssetsPageProps) {
  const [activeFilter, setActiveFilter] = useState<AssetFilterId>(initialFilter);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [previewRequests, setPreviewRequests] = useState<OperationRequest[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  const { showToast } = useToast();

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
  const detailAsset = selectedAsset && filteredAssets.some((asset) => asset.id === selectedAsset.id)
    ? selectedAsset
    : filteredAssets[0] ?? null;

  const buildOperationRequest = (asset: Asset, operation: string, platformId?: string): OperationRequest | null => {
    const installation = platformId
      ? asset.installations.find((inst) => normalizePlatform(inst.platformId).includes(normalizePlatform(platformId)))
      : asset.installations[0];

    if (!installation) {
      showToast(`资产 ${asset.name} 没有可操作的安装路径`, 'error');
      return null;
    }

    return {
      operationType: operation,
      targetId: asset.id,
      targetName: asset.name,
      targetType: asset.type,
      targetPath: installation.path,
      official: installation.official || asset.status.includes('official'),
      riskLevel: asset.riskLevel,
      platformId: installation.platformId,
    };
  };

  const showPreview = async (asset: Asset, operation: string, platformId?: string) => {
    const request = buildOperationRequest(asset, operation, platformId);
    if (!request) {
      return;
    }

    const actionKey = `${operation}:${asset.id}:${platformId ?? 'primary'}`;
    setBusyKey(actionKey);
    try {
      const nextPreview = await api.previewOperation(request);
      setPreviewRequests([request]);
      setPreview(nextPreview);
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法生成操作预览';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const previewInstallRequests = async (asset: Asset, requests: OperationRequest[]) => {
    if (requests.length === 0) {
      showToast('没有可安装的目标平台', 'warning');
      return;
    }

    setSelectedAsset(asset);
    const actionKey = `install:${asset.id}:${requests.map((request) => request.platformId).join(',')}`;
    setBusyKey(actionKey);
    try {
      const previews = await Promise.all(requests.map((request) => api.previewOperation(request)));
      setPreviewRequests(requests);
      setPreview(aggregatePreviews(asset.name, previews, requests));
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法生成安装预览';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleInstallClick = (asset: Asset, target?: PlatformTarget) => {
    if (target) {
      if (isInstalledOnPlatform(asset, target)) {
        showToast(`「${asset.name}」已安装于 ${target.name}`, 'info');
        return;
      }

      if (target.writable === 'readonly') {
        showToast(`${target.name} 当前只读，不能直接安装`, 'warning');
        return;
      }

      const request = buildInstallOperationRequest(asset, target);
      if (!request) {
        showToast(`${target.name} 缺少可写入的资产目录`, 'warning');
        return;
      }

      void previewInstallRequests(asset, [request]);
      return;
    }

    const requests = availablePlatformTargets
      .filter((platform) => platform.writable !== 'readonly')
      .filter((platform) => !isInstalledOnPlatform(asset, platform))
      .map((platform) => buildInstallOperationRequest(asset, platform))
      .filter((request): request is OperationRequest => Boolean(request));

    void previewInstallRequests(asset, requests);
  };

  const handleConfirm = async () => {
    if (previewRequests.length === 0 || !preview) {
      return;
    }

    const actionKey = `confirm:${previewRequests.map((request) => request.targetPath).join('|')}`;
    setBusyKey(actionKey);
    try {
      const results = [];
      for (const request of previewRequests) {
        results.push(await api.executeOperation(request));
      }
      showToast(results.length > 1 ? `已安装到 ${results.length} 个平台` : results[0]?.message ?? '已完成安装', 'success');
      setPreview(null);
      setPreviewRequests([]);
      await onRefresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行操作失败';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const renderPlatformButtons = (asset: Asset, compact = false) => (
    <div className="flex items-center gap-1.5">
      {availablePlatformTargets.map((target) => {
        const installed = isInstalledOnPlatform(asset, target);
        return (
          <button
            key={target.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleInstallClick(asset, target);
            }}
            className={`relative flex items-center justify-center rounded-lg border transition-colors ${
              compact ? 'h-8 w-8' : 'h-9 w-9'
            } ${
              installed
                ? 'border-gray-200 bg-gray-900 text-white shadow-sm'
                : 'border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400 hover:bg-gray-50'
            }`}
            title={`${installed ? '已安装于' : '添加到'} ${target.name}`}
          >
            <PlatformIcon kind={target.kind} platformName={target.name} className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            {installed && (
              <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-green-600" />
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleInstallClick(asset);
        }}
        className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors`}
        title="添加到全部平台"
      >
        <Plus className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
    </div>
  );

  const renderAssetCard = (asset: Asset, index: number) => (
    <motion.article
      key={asset.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      onClick={() => setSelectedAsset(asset)}
      className={`min-w-0 cursor-pointer rounded-lg border bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm ${
        detailAsset?.id === asset.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 whitespace-nowrap">
              {getAssetTypeLabel(asset.type)}
            </span>
            <Badge risk={asset.riskLevel} />
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-gray-900" title={asset.name}>
            {asset.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedAsset(asset);
          }}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="更多"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-gray-500">
        {asset.description || '暂无描述'}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-gray-50 px-2 py-1.5">
          <div className="text-gray-400 whitespace-nowrap">版本</div>
          <div className="mt-0.5 truncate font-medium text-gray-700">{asset.version || '未知'}</div>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-1.5">
          <div className="text-gray-400 whitespace-nowrap">来源</div>
          <div className="mt-0.5 truncate font-medium text-gray-700">{asset.source || '本机'}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">安装平台</span>
          <span className="text-[11px] text-gray-400 whitespace-nowrap">
            {asset.installations.length} 个位置
          </span>
        </div>
        {renderPlatformButtons(asset)}
      </div>

      <div className="mt-3 truncate rounded-md bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-500" title={getPrimaryPath(asset)}>
        {getPrimaryPath(asset)}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatDate(asset.updatedAt)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              void showPreview(asset, 'disable');
            }}
            disabled={busyKey === `disable:${asset.id}:primary`}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            title="禁用"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              void showPreview(asset, 'delete');
            }}
            disabled={busyKey === `delete:${asset.id}:primary`}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="移入回收站"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-gray-100 bg-white/70 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">资产库</h2>
              <p className="mt-0.5 text-xs text-gray-500 whitespace-nowrap">按类型管理本机 Agent 资产 SKU</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索资产或路径"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400"
                />
              </label>
              <button className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Filter className="h-4 w-4" />
                <span className="whitespace-nowrap">筛选</span>
              </button>
              <div className="flex h-9 rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${
                    viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span className="whitespace-nowrap">列表</span>
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${
                    viewMode === 'cards' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Grid2X2 className="h-4 w-4" />
                  <span className="whitespace-nowrap">卡片</span>
                </button>
              </div>
              <button className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800">
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">新增资产</span>
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {assetFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`filter-chip ${activeFilter === filter.id ? 'active' : 'bg-gray-50 text-gray-600'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {viewMode === 'cards' ? (
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
                    {group.assets.map((asset, index) => renderAssetCard(asset, index))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="section-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-3 font-medium">资产</th>
                      <th className="px-5 py-3 font-medium">类型</th>
                      <th className="px-5 py-3 font-medium">描述</th>
                      <th className="px-5 py-3 font-medium">安装平台</th>
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
                        className={`table-row-hover cursor-pointer border-t border-gray-50 ${detailAsset?.id === asset.id ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setSelectedAsset(asset)}
                      >
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
                        <td className="px-5 py-3">{renderPlatformButtons(asset, true)}</td>
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
                                void showPreview(asset, 'disable');
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
                                void showPreview(asset, 'delete');
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
          )}

          {filteredAssets.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              <Box className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm">没有符合条件的资产</p>
            </div>
          )}
        </div>
      </div>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 whitespace-nowrap">资产详情</h3>
          {detailAsset && (
            <button
              onClick={() => setSelectedAsset(null)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              title="清除选择"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
          )}
        </div>

        {detailAsset ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-blue-700">
                  {getAssetTypeLabel(detailAsset.type)}
                </span>
                <Badge risk={detailAsset.riskLevel} />
              </div>
              <div className="mt-2 font-semibold text-gray-900">{detailAsset.name}</div>
              <div className="mt-1 text-xs leading-5 text-gray-600">{detailAsset.description || '暂无描述'}</div>
            </div>

            <div>
              <div className="mb-2 text-gray-500 whitespace-nowrap">安装平台</div>
              {renderPlatformButtons(detailAsset)}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="text-xs text-gray-400 whitespace-nowrap">版本</div>
                <div className="mt-1 truncate text-gray-800">{detailAsset.version || '未知'}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="text-xs text-gray-400 whitespace-nowrap">作者</div>
                <div className="mt-1 truncate text-gray-800">{detailAsset.author || '未知'}</div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-gray-500 whitespace-nowrap">状态</div>
              <div className="flex flex-wrap gap-1">
                {detailAsset.status.map((status) => (
                  <Badge key={status} status={status} />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-gray-500 whitespace-nowrap">安装位置</div>
              <div className="space-y-1.5">
                {detailAsset.installations.map((installation) => (
                  <div key={installation.id} className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700">
                      {installation.path}
                    </code>
                    <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <button
                onClick={() => handleInstallClick(detailAsset)}
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
                  onClick={() => { void showPreview(detailAsset, 'disable'); }}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">禁用</span>
                </button>
                <button
                  onClick={() => { void showPreview(detailAsset, 'delete'); }}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">回收</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            选择一个资产查看详情
          </div>
        )}
      </aside>

      {preview && (
        <PreviewModal
          preview={preview}
          onClose={() => {
            setPreview(null);
            setPreviewRequests([]);
          }}
          onConfirm={() => { void handleConfirm(); }}
        />
      )}
    </div>
  );
}
