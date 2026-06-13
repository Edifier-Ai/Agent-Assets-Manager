import { useState } from 'react';
import * as api from '../api';
import type { Asset, OperationPreview, OperationRequest } from '../types';
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
    if (previewRequests.length === 0 || !preview) return;

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
      await onRefresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行操作失败';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
      setProgress(null);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setPreviewRequests([]);
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
  };
}
