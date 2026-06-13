import type { Asset, AssetFilterId, AssetType, OperationPreview, OperationRequest } from '../../types';
import { getAssetTypeLabel } from '../../utils';
import {
  assetTypeOrder,
  assetTypeSubdirByPlatform,
  configAssetTypes,
  defaultAssetTypeSubdirs,
  type PlatformTarget,
} from './constants';

export type AssetGroup = {
  id: AssetType;
  label: string;
  assets: Asset[];
};

export interface InstallTargetPathExplanation {
  sourcePath: string;
  targetRoot: string;
  targetSubdir: string;
  targetPath: string;
  reason: string;
}

export function matchesAssetFilter(asset: Asset, activeFilter: AssetFilterId): boolean {
  if (activeFilter === 'all') return true;
  if (activeFilter === 'config') return configAssetTypes.includes(asset.type);
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

export function normalizePlatform(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

export function assetMatchesSearch(asset: Asset, query: string): boolean {
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

export function isInstalledOnPlatform(asset: Asset, target: PlatformTarget): boolean {
  const targetId = normalizePlatform(target.id);
  return asset.installations.some((installation) => {
    const platformId = normalizePlatform(installation.platformId);
    const platformName = normalizePlatform(installation.platformName);
    return platformId.includes(targetId) || platformName.includes(targetId);
  });
}

export function getPrimaryPath(asset: Asset): string {
  return asset.installations[0]?.path ?? '未发现安装路径';
}

export function getSourcePathForInstall(asset: Asset): string | null {
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

function getInstallTargetParts(asset: Asset, platform: PlatformTarget): {
  sourcePath: string;
  root: string;
  subdir: string;
  targetPath: string;
  platformSpecific: boolean;
} | null {
  const root = platform.configRoots?.[0];
  if (!root) return null;

  const sourcePath = getSourcePathForInstall(asset);
  if (!sourcePath) return null;

  const platformSubdirs = assetTypeSubdirByPlatform[platform.id];
  const platformSpecific = platformSubdirs?.[asset.type] !== undefined;
  const subdir = platformSubdirs?.[asset.type] ?? defaultAssetTypeSubdirs[asset.type];
  if (subdir === undefined) return null;

  const base = sanitizeAssetName(asset.name);
  const rootPath = root.replace(/\/+$/g, '');
  const parent = subdir ? `${rootPath}/${subdir}` : rootPath;
  const targetPath = asset.type === 'Skill' || asset.type === 'Agent'
    ? `${parent}/${base}`
    : `${parent}/${base}${extensionForAsset(asset, sourcePath)}`;

  return { sourcePath, root: rootPath, subdir, targetPath, platformSpecific };
}

function getInstallTargetPath(asset: Asset, platform: PlatformTarget): string | null {
  return getInstallTargetParts(asset, platform)?.targetPath ?? null;
}

export function explainInstallTargetPath(asset: Asset, platform: PlatformTarget): InstallTargetPathExplanation | null {
  const parts = getInstallTargetParts(asset, platform);
  if (!parts) return null;

  const targetSubdir = parts.subdir || '平台配置根目录';
  const reason = parts.platformSpecific
    ? `${platform.name} 使用平台专属目录 ${targetSubdir} 存放 ${asset.type} 资产`
    : `${platform.name} 使用默认目录 ${targetSubdir} 存放 ${asset.type} 资产`;

  return {
    sourcePath: parts.sourcePath,
    targetRoot: parts.root,
    targetSubdir,
    targetPath: parts.targetPath,
    reason,
  };
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

export function aggregatePreviews(
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
