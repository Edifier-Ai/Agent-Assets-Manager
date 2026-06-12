import { useState } from 'react';
import {
  Brain, Key, Shield, AlertTriangle, CheckCircle
} from 'lucide-react';

import { modelBindings, modelProfiles } from '../data/mockData';
import { formatDate, maskApiKey, getKeyStorageLabel, getValidationStatusLabel, getValidationStatusColor } from '../utils';

export default function ModelsPage() {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

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
            {modelProfiles.map((profile) => (
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
                    <div className="mt-2 flex gap-2">
                      <button className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                        查看详情
                      </button>
                      <button className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                        应用配置
                      </button>
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
    </div>
  );
}
