import { useState } from 'react';
import * as api from '../api';
import type { Asset, BatchSyncPreview, BatchSyncRequest, OperationPreview, OperationRequest } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';
import { buildInstallOperationRequest, aggregatePreviews, explainInstallTargetPath, isInstalledOnPlatform, normalizePlatform } from '../pages/assets/logic';

interface UseAssetOperationsOptions {
  availablePlatformTargets: PlatformTarget[];
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRefresh?: () => Promise<void>;
}

interface PendingDestructive {
  asset: Asset;
  operation: string;
  platformId?: string;
}

interface Progress {
  current: number;
  total: number;
}

export function useAssetOperations({ availablePlatformTargets, showToast, onRefresh }: UseAssetOperationsOptions) {
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [previewRequests, setPreviewRequests] = useState<OperationRequest[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<PendingDestructive | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pendingBatchSync, setPendingBatchSync] = useState<BatchSyncRequest | null>(null);

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
    if (operation === 'delete' || operation === 'disable') {
      setPendingDestructive({ asset, operation, platformId });
      return;
    }

    const request = buildOperationRequest(asset, operation, platformId);
    if (!request) return;

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

  const confirmDestructive = async () => {
    if (!pendingDestructive) return;
    const { asset, operation, platformId } = pendingDestructive;
    setPendingDestructive(null);

    const request = buildOperationRequest(asset, operation, platformId);
    if (!request) return;

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

  const cancelDestructive = () => {
    setPendingDestructive(null);
  };

  const previewInstallRequests = async (asset: Asset, requests: OperationRequest[]) => {
    if (requests.length === 0) {
      showToast('没有可安装的目标平台', 'warning');
      return;
    }

    const actionKey = `install:${asset.id}:${requests.map((request) => request.platformId).join(',')}`;
    setBusyKey(actionKey);
    try {
      const previews = await Promise.all(requests.map(async (request) => {
        const preview = await api.previewOperation(request);
        const target = availablePlatformTargets.find((platform) => platform.id === request.platformId);
        const explanation = target ? explainInstallTargetPath(asset, target) : null;
        return explanation
          ? { ...preview, risks: [...preview.risks, `路径依据：${explanation.reason}`] }
          : preview;
      }));
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
    if (!preview) return;

    if (pendingBatchSync) {
      const actionKey = `confirm-batch:${pendingBatchSync.strategy}:${pendingBatchSync.items.length}`;
      setBusyKey(actionKey);
      setProgress({ current: 0, total: Math.max(pendingBatchSync.items.length, 1) });
      try {
        const result = await api.executeSkillSyncPlan(pendingBatchSync);
        showToast(result.message, result.failedCount > 0 ? 'warning' : 'success');
        setPreview(null);
        setPreviewRequests([]);
        setPendingBatchSync(null);
        await onRefresh?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : '批量同步执行失败';
        showToast(message, 'error');
      } finally {
        setBusyKey(null);
        setProgress(null);
      }
      return;
    }

    if (previewRequests.length === 0) return;

    const actionKey = `confirm:${previewRequests.map((request) => request.targetPath).join('|')}`;
    setBusyKey(actionKey);
    const total = previewRequests.length;
    if (total > 1) setProgress({ current: 0, total });
    try {
      const results = [];
      for (let i = 0; i < previewRequests.length; i++) {
        if (total > 1) setProgress({ current: i + 1, total });
        results.push(await api.executeOperation(previewRequests[i]));
      }
      showToast(results.length > 1 ? `已安装到 ${results.length} 个平台` : results[0]?.message ?? '已完成安装', 'success');
      setPreview(null);
      setPreviewRequests([]);
      setPendingBatchSync(null);
      await onRefresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行操作失败';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
      setProgress(null);
    }
  };

  const handleBatchInstall = async (
    skills: Asset[],
    strategy: 'install-all' | 'sync-from-source',
    sourcePlatformId?: string,
  ) => {
    if (skills.length === 0) {
      showToast('未选择任何 Skill', 'warning');
      return;
    }

    const actionKey = `batch-install:${strategy}:${skills.length}`;
    setBusyKey(actionKey);

    try {
      const batchPreview = await api.previewSkillSyncPlan(
        skills.map((skill) => skill.id),
        strategy,
        strategy === 'sync-from-source' ? sourcePlatformId : undefined,
      );
      const installItems = batchPreview.items.filter((item) => item.action === 'install' && item.supported);

      if (installItems.length === 0) {
        setPreview(batchSyncPreviewToOperationPreview(batchPreview, skills.length));
        setPreviewRequests([]);
        setPendingBatchSync(null);
        showToast(batchPreview.hasConflicts ? '存在内容冲突，需要先选择处理策略' : '没有需要同步的目标平台', 'info');
        return;
      }

      setPreview(batchSyncPreviewToOperationPreview(batchPreview, skills.length));
      setPreviewRequests([]);
      setPendingBatchSync({
        strategy,
        sourcePlatformId: strategy === 'sync-from-source' ? sourcePlatformId : undefined,
        items: batchPreview.items.map((item) => ({
          assetId: item.assetId,
          assetName: item.assetName,
          sourcePath: item.sourcePath,
          targetPlatform: item.targetPlatform,
          targetPath: item.targetPath,
          action: item.action,
          existingHash: item.existingHash,
          sourceHash: item.sourceHash,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '批量预览生成失败';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
      setProgress(null);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setPreviewRequests([]);
    setPendingBatchSync(null);
  };

  return {
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
  };
}

function batchSyncPreviewToOperationPreview(
  batchPreview: BatchSyncPreview,
  selectedSkillCount: number,
): OperationPreview {
  const installItems = batchPreview.items.filter((item) => item.action === 'install' && item.supported);
  const conflictItems = batchPreview.items.filter((item) => item.action === 'conflict');
  const skippedUnsupported = batchPreview.items.filter((item) => !item.supported && item.action !== 'conflict');
  const riskLines = [
    batchPreview.summary,
    ...conflictItems.slice(0, 6).map((item) => `${item.assetName} 在 ${item.targetPlatformName} 内容不同，已默认跳过`),
    ...skippedUnsupported.slice(0, 4).map((item) => `${item.assetName} 在 ${item.targetPlatformName}: ${item.reason}`),
  ];

  if (conflictItems.length > 6) {
    riskLines.push(`还有 ${conflictItems.length - 6} 个冲突未展开`);
  }

  return {
    operationType: `batch-sync-${batchPreview.strategy}`,
    targetName: `${selectedSkillCount} 个 Skill`,
    targetType: 'Skill',
    targetPath: installItems.map((item) => item.targetPath).join('\n') || '没有可执行的目标路径',
    sourcePath: batchPreview.strategy === 'sync-from-source' ? installItems[0]?.sourcePath : undefined,
    filesToModify: installItems.map((item) => item.targetPath),
    filesToMove: Array.from(new Set(installItems.map((item) => item.sourcePath))),
    backupPaths: installItems.map((item) => item.targetPath),
    writtenKeys: installItems.map((item) => `${item.assetName} -> ${item.targetPlatformName}`),
    needsRestart: installItems.length > 0,
    risks: riskLines.filter(Boolean),
    supported: installItems.length > 0,
  };
}
