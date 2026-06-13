import { useToast } from '../components/Toast';
import { useEffect, useState } from 'react';
import {
  Folder, Database, Sun, Moon, Monitor, Shield, Save, CheckCircle2, Plus, Trash2
} from 'lucide-react';
import type { AppSettings, SaveSettingsInput } from '../types';

interface SettingsPageProps {
  settings?: AppSettings;
  onSaveSettings?: (settings: SaveSettingsInput) => Promise<void>;
}

const DEFAULT_SCAN_PATHS = ['~/.codex', '~/.claude', '~/.opencode', '~/.hermes', '~/.openclaw'];
const DEFAULT_DB_LOCATION = '~/Library/Application Support/Agent Assets Manager/data.db';
const DEFAULT_TRASH_LOCATION = '~/Library/Application Support/Agent Assets Manager/Trash';

export function resolveSettingsFormState(settings?: AppSettings): SaveSettingsInput {
  return {
    theme: settings?.theme ?? 'system',
    scanPaths: settings?.scanPaths ?? DEFAULT_SCAN_PATHS,
    includeProjectLocal: settings?.includeProjectLocal ?? true,
    enableDeepScan: settings?.enableDeepScan ?? false,
    dbLocation: settings?.dbLocation ?? DEFAULT_DB_LOCATION,
    trashLocation: settings?.trashLocation ?? DEFAULT_TRASH_LOCATION,
  };
}

export default function SettingsPage({ settings, onSaveSettings }: SettingsPageProps) {
  const [theme, setTheme] = useState('system');
  const [scanPaths, setScanPaths] = useState<string[]>(DEFAULT_SCAN_PATHS);
  const [includeProjectLocal, setIncludeProjectLocal] = useState(true);
  const [enableDeepScan, setEnableDeepScan] = useState(false);
  const [dbLocation, setDbLocation] = useState(DEFAULT_DB_LOCATION);
  const [trashLocation, setTrashLocation] = useState(DEFAULT_TRASH_LOCATION);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const nextState = resolveSettingsFormState(settings);
    setTheme(nextState.theme);
    setScanPaths(nextState.scanPaths);
    setIncludeProjectLocal(nextState.includeProjectLocal);
    setEnableDeepScan(nextState.enableDeepScan);
    setDbLocation(nextState.dbLocation);
    setTrashLocation(nextState.trashLocation);
  }, [settings]);

  const handleReset = () => {
    const nextState = resolveSettingsFormState(settings);
    setTheme(nextState.theme);
    setScanPaths(nextState.scanPaths);
    setIncludeProjectLocal(nextState.includeProjectLocal);
    setEnableDeepScan(nextState.enableDeepScan);
    setDbLocation(nextState.dbLocation);
    setTrashLocation(nextState.trashLocation);
  };

  const updateScanPath = (index: number, value: string) => {
    setScanPaths((paths) => paths.map((path, currentIndex) => (
      currentIndex === index ? value : path
    )));
  };

  const removeScanPath = (index: number) => {
    setScanPaths((paths) => paths.filter((_, currentIndex) => currentIndex !== index));
  };

  const addScanPath = () => {
    setScanPaths((paths) => [...paths, '']);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveSettings?.({
        theme,
        scanPaths: scanPaths.map((path) => path.trim()).filter(Boolean),
        includeProjectLocal,
        enableDeepScan,
        dbLocation: dbLocation.trim(),
        trashLocation: trashLocation.trim(),
      });
      setSaved(true);
      showToast('设置已保存', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : '设置保存失败';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full overflow-y-auto">
      <div className="flex-1 p-5 max-w-2xl mx-auto w-full space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">设置</h2>
          <p className="text-sm text-gray-500 mt-1">配置扫描、数据、安全和外观偏好</p>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">扫描设置</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">默认扫描路径</div>
              <div className="space-y-2">
                {scanPaths.map((path, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={path}
                      onChange={(event) => updateScanPath(i, event.target.value)}
                      className="flex-1 text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-transparent focus:border-gray-300 focus:outline-none"
                    />
                    <button
                      onClick={() => removeScanPath(i)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="移除路径"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addScanPath}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加扫描路径
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">包含项目本地路径</span>
                <button
                  onClick={() => setIncludeProjectLocal(!includeProjectLocal)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ${includeProjectLocal ? 'bg-gray-900' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${includeProjectLocal ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">启用深度扫描</span>
                <button
                  onClick={() => setEnableDeepScan(!enableDeepScan)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ${enableDeepScan ? 'bg-gray-900' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${enableDeepScan ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">数据设置</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1.5">SQLite 数据库位置</div>
              <input
                value={dbLocation}
                onChange={(event) => setDbLocation(event.target.value)}
                className="block w-full text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-transparent focus:border-gray-300 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1.5">应用管理回收站位置</div>
              <input
                value={trashLocation}
                onChange={(event) => setTrashLocation(event.target.value)}
                className="block w-full text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-transparent focus:border-gray-300 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">外观</h3>
            </div>
          </div>
          <div className="p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">主题</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'system', label: '跟随系统', icon: Monitor },
                { id: 'light', label: '浅色', icon: Sun },
                { id: 'dark', label: '深色', icon: Moon },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${theme === t.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">安全</h3>
            </div>
          </div>
          <div className="p-5">
            <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-600">
              <div className="font-medium text-gray-700 mb-1">安全确认级别</div>
              <p>所有状态变更操作都需要预览确认。删除操作默认移入回收站，永久删除需要二次确认。</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            重置
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                已保存
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存设置'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
