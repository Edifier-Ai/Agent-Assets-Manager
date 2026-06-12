import { useState } from 'react';
import {
  Hexagon, Sun, Cloud, Feather, PawPrint, Layers, CheckCircle, Eye, Terminal
} from 'lucide-react';
import Badge from '../components/Badge';
import { platforms } from '../data/mockData';
import type { Platform } from '../types';

const platformIcons: Record<string, React.ElementType> = {
  codex: Hexagon,
  claude: Sun,
  opencode: Cloud,
  hermes: Feather,
  openclaw: PawPrint,
};

export default function PlatformsPage() {
  const [selected, setSelected] = useState<Platform>(platforms[0]);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4">
          {platforms.map((p) => {
            const Icon = platformIcons[p.kind] || Layers;
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`kpi-card cursor-pointer transition-all duration-200 ${selected?.id === p.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge status={p.status === 'active' ? 'enabled' : 'disabled'} />
                        <Badge status={p.writable === 'writable' ? 'writable' : p.writable === 'readonly' ? 'readonly' : 'partial'} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{p.assetCount}</div>
                    <div className="text-xs text-gray-500">资产</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">CLI 路径</div>
                    <code className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded block truncate">{p.cliPath}</code>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">版本</div>
                    <div className="text-gray-700 font-medium">{p.version}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">警告</div>
                    <div className={`font-medium ${p.warningCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {p.warningCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="w-80 bg-white border-l border-gray-100 overflow-y-auto p-5 shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              {(() => {
                const Icon = platformIcons[selected.kind] || Layers;
                return <Icon className="w-5 h-5 text-white" />;
              })()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{selected.name}</h3>
              <p className="text-xs text-gray-400">{selected.kind}</p>
            </div>
          </div>

          <div className="space-y-5 text-sm">
            <div>
              <div className="text-gray-500 mb-1.5">CLI 路径</div>
              <code className="block text-xs font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg break-all">{selected.cliPath}</code>
            </div>

            <div>
              <div className="text-gray-500 mb-1.5">版本</div>
              <div className="text-gray-900 font-medium">{selected.version}</div>
            </div>

            <div>
              <div className="text-gray-500 mb-1.5">配置根目录</div>
              <div className="space-y-1.5">
                {selected.configRoots.map((root, i) => (
                  <code key={i} className="block text-xs font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg break-all">{root}</code>
                ))}
              </div>
            </div>

            <div>
              <div className="text-gray-500 mb-1.5">可写状态</div>
              <div className={`font-medium ${selected.writable === 'writable' ? 'text-blue-600' : selected.writable === 'readonly' ? 'text-gray-500' : 'text-amber-600'}`}>
                {selected.writable === 'writable' ? '可写' : selected.writable === 'readonly' ? '只读' : '部分可写'}
              </div>
              {selected.writable === 'partial' && (
                <p className="text-xs text-gray-500 mt-1">部分配置根目录为只读</p>
              )}
            </div>

            <div>
              <div className="text-gray-500 mb-2">安全操作</div>
              <div className="space-y-1.5">
                {selected.safeActions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {action}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-gray-500 mb-2">需要预览</div>
              <div className="space-y-1.5">
                {selected.previewRequiredActions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-600">
                    <Eye className="w-3.5 h-3.5 text-amber-500" />
                    {action}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors">
                <Terminal className="w-4 h-4" />
                在终端中打开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
