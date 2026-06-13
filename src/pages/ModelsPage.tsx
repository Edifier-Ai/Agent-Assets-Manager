import { useEffect, useMemo, useState } from 'react';
import {
  Brain, Key, Shield, AlertTriangle, CheckCircle
} from 'lucide-react';

import PreviewModal from '../components/PreviewModal';
import { useToast } from '../components/Toast';
import * as api from '../api';
import { formatDate, maskApiKey, getKeyStorageLabel, getValidationStatusLabel, getValidationStatusColor } from '../utils';
import type { ModelBinding, ModelProfile, OperationPreview, OperationRequest, Platform } from '../types';

interface ModelsPageProps {
  platforms: Platform[];
  modelBindings: ModelBinding[];
  onRefresh?: () => Promise<void>;
}

function supportsApplyPreview(platform?: Platform): boolean {
  return Boolean(platform && platform.writable !== 'readonly');
}

function getApplySupportLabel(platform?: Platform): string {
  if (!platform) {
    return '平台信息缺失';
  }

  if (platform.writable === 'readonly') {
    return '当前平台只读';
  }

  if (platform.writable === 'partial') {
    return '支持受控写入预览';
  }

  return '支持应用预览';
}

export default function ModelsPage({ platforms, modelBindings, onRefresh }: ModelsPageProps) {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [previewRequest, setPreviewRequest] = useState<OperationRequest | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { showToast } = useToast();

  const platformById = useMemo(
    () => new Map(platforms.map((platform) => [platform.id, platform])),
    [platforms],
  );

  useEffect(() => {
    let active = true;

    setLoadingProfiles(true);
    api.getModelProfiles()
      .then((rows) => {
        if (!active) {
          return;
        }
        setProfiles(rows);
        setProfilesError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setProfiles([]);
        setProfilesError(error instanceof Error ? error.message : '加载模型 Profiles 失败');
      })
      .finally(() => {
        if (active) {
          setLoadingProfiles(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handlePreviewApply = async (profile: ModelProfile, binding: ModelBinding) => {
    const actionKey = `${profile.id}:${binding.id}`;
    setBusyKey(actionKey);

    try {
      const request: OperationRequest = {
        operationType: 'apply-model-profile',
        targetId: profile.id,
        targetName: profile.name,
        targetType: 'Model Profile',
        targetPath: binding.configPath,
        official: false,
        riskLevel: 'medium',
        platformId: binding.platformId,
      };
      const nextPreview = await api.previewOperation(request);
      setPreviewRequest(request);
      setPreview(nextPreview);
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法生成模型应用预览';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleExecuteApply = async () => {
    if (!previewRequest) {
      return;
    }

    const actionKey = `${previewRequest.targetId ?? 'profile'}:${previewRequest.platformId ?? 'platform'}`;
    setBusyKey(actionKey);
    try {
      const result = await api.executeOperation(previewRequest);
      showToast(result.message, 'success');
      setPreview(null);
      setPreviewRequest(null);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '应用模型配置失败';
      showToast(message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">模型配置</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">平台</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">模型 ID</th>
                  <th className="px-5 py-3 font-medium">API Base URL</th>
                  <th className="px-5 py-3 font-medium">配置来源</th>
                  <th className="px-5 py-3 font-medium">API Key</th>
                  <th className="px-5 py-3 font-medium">验证状态</th>
                </tr>
              </thead>
              <tbody>
                {modelBindings.map((mb) => (
                  <tr key={mb.id} className="table-row-hover border-t border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{mb.platformName}</td>
                    <td className="px-5 py-3 text-gray-600">{mb.detectedProvider}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm text-gray-900">{mb.detectedModelId}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-gray-500">{mb.detectedBaseUrl}</span>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{mb.configPath}</code>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Key className={`w-3.5 h-3.5 ${mb.keyPresence ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className="text-gray-600">
                          {mb.keyPresence ? maskApiKey(mb.keySuffix || '****') : '未配置'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        存储位置：{getKeyStorageLabel(mb.keyStorage)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {mb.validationStatus === 'ok' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span className={getValidationStatusColor(mb.validationStatus)}>
                          {getValidationStatusLabel(mb.validationStatus)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDate(mb.lastValidatedAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">模型 Profiles</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingProfiles && (
              <div className="col-span-full p-6 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                正在从 SQLite 加载模型 Profiles...
              </div>
            )}
            {!loadingProfiles && profilesError && (
              <div className="col-span-full p-6 rounded-xl border border-red-100 bg-red-50 text-sm text-red-600">
                {profilesError}
              </div>
            )}
            {!loadingProfiles && !profilesError && profiles.length === 0 && (
              <div className="col-span-full p-6 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                当前没有已持久化的模型 Profile。
              </div>
            )}
            {!loadingProfiles && !profilesError && profiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfile(selectedProfile === profile.id ? null : profile.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedProfile === profile.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                    <Brain className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{profile.name}</div>
                    <div className="text-xs text-gray-500">{profile.provider}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">模型</span>
                    <span className="font-mono text-xs text-gray-700">{profile.modelId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Base URL</span>
                    <span className="font-mono text-xs text-gray-500 truncate max-w-[150px]">{profile.baseUrl}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Key</span>
                    <span className="text-xs text-gray-600">{getKeyStorageLabel(profile.keyStorage)}</span>
                  </div>
                </div>
                {selectedProfile === profile.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">{profile.notes}</p>
                    <div className="mt-3 space-y-2">
                      {modelBindings.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
                          当前没有检测到可应用的模型配置目标。
                        </div>
                      )}
                      {modelBindings.map((binding) => {
                        const platform = platformById.get(binding.platformId);
                        const actionKey = `${profile.id}:${binding.id}`;
                        const supported = supportsApplyPreview(platform);

                        return (
                          <div
                            key={binding.id}
                            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-gray-900">{binding.platformName}</div>
                                <div className="mt-1 text-[11px] text-gray-500">
                                  当前模型：{binding.detectedModelId}
                                </div>
                                <code className="mt-1 block text-[11px] text-gray-500 break-all">
                                  {binding.configPath}
                                </code>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${supported ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                {getApplySupportLabel(platform)}
                              </span>
                            </div>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handlePreviewApply(profile, binding);
                              }}
                              disabled={busyKey === actionKey}
                              className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${supported ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              {busyKey === actionKey ? '正在生成预览...' : supported ? '预览应用配置' : '查看写入限制'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900">安全提醒</h3>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-800">API Key 存储位置提醒</div>
                <p className="text-amber-700 mt-1">OpenCode 的 API Key 存储在配置文件中（<code className="font-mono text-xs">~/.opencode/config.yaml</code>），建议迁移至环境变量或 Keychain。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-blue-800">Codex 配置安全</div>
                <p className="text-blue-700 mt-1">Codex 的 API Key 存储在环境变量中，符合安全最佳实践。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <PreviewModal
          preview={preview}
          onConfirm={preview.supported ? () => { void handleExecuteApply(); } : undefined}
          onClose={() => {
            setPreview(null);
            setPreviewRequest(null);
          }}
        />
      )}
    </div>
  );
}
