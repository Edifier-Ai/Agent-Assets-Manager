import { useToast } from '../components/Toast';
import { useEffect, useMemo, useState } from 'react';
import {
  Folder, Database, Sun, Moon, Monitor, Shield, Save, CheckCircle2, Plus, Trash2, EyeOff
} from 'lucide-react';
import FormField from '../components/FormField';
import PlatformIcon from '../components/PlatformIcon';
import type { AppSettings, Platform, SaveSettingsInput } from '../types';

interface SettingsPageProps {
  settings?: AppSettings;
  platforms?: Platform[];
  onSaveSettings?: (settings: SaveSettingsInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const DEFAULT_SCAN_PATHS = [
  '~/.codex',
  '~/.claude',
  '~/Library/Application Support/Claude',
  '~/.opencode',
  '~/.hermes',
  '~/.openclaw',
];
const DEFAULT_DB_LOCATION = '~/Library/Application Support/Agent Assets Manager/data.db';
const DEFAULT_TRASH_LOCATION = '~/Library/Application Support/Agent Assets Manager/Trash';
type AppliedTheme = 'light' | 'dark';

interface ThemeClassTarget {
  classList: {
    toggle: (className: string, force?: boolean) => boolean;
  };
  setAttribute?: (name: string, value: string) => void;
}

function validatePath(value: string): string | undefined {
  if (!value.trim()) return '路径不能为空';
  if (!value.startsWith('~/') && !value.startsWith('/')) return '路径必须以 ~/ 或 / 开头';
  if (value.includes('//')) return '路径不能包含连续的 //';
  return undefined;
}

function validateDbPath(value: string): string | undefined {
  const base = validatePath(value);
  if (base) return base;
  if (!value.endsWith('.db')) return '数据库路径必须以 .db 结尾';
  return undefined;
}

export function resolveSettingsFormState(settings?: AppSettings): SaveSettingsInput {
  return {
    theme: settings?.theme ?? 'system',
    scanPaths: settings?.scanPaths ?? DEFAULT_SCAN_PATHS,
    includeProjectLocal: settings?.includeProjectLocal ?? true,
    enableDeepScan: settings?.enableDeepScan ?? false,
    dbLocation: settings?.dbLocation ?? DEFAULT_DB_LOCATION,
    trashLocation: settings?.trashLocation ?? DEFAULT_TRASH_LOCATION,
    ignoredPlatformIds: settings?.ignoredPlatformIds ?? [],
  };
}

export function resolveAppliedTheme(theme: string, prefersDark: boolean): AppliedTheme {
  return theme === 'dark' || (theme === 'system' && prefersDark) ? 'dark' : 'light';
}

export function applyThemePreference(
  theme: string,
  root: ThemeClassTarget,
  prefersDark: boolean,
): AppliedTheme {
  const appliedTheme = resolveAppliedTheme(theme, prefersDark);
  root.classList.toggle('dark', appliedTheme === 'dark');
  root.classList.toggle('theme-dark', appliedTheme === 'dark');
  root.classList.toggle('theme-light', appliedTheme === 'light');
  root.setAttribute?.('data-theme', appliedTheme);
  return appliedTheme;
}

export default function SettingsPage({ settings, platforms = [], onSaveSettings, onDirtyChange }: SettingsPageProps) {
  const [theme, setTheme] = useState('system');
  const [scanPaths, setScanPaths] = useState<string[]>(DEFAULT_SCAN_PATHS);
  const [includeProjectLocal, setIncludeProjectLocal] = useState(true);
  const [enableDeepScan, setEnableDeepScan] = useState(false);
  const [dbLocation, setDbLocation] = useState(DEFAULT_DB_LOCATION);
  const [trashLocation, setTrashLocation] = useState(DEFAULT_TRASH_LOCATION);
  const [ignoredPlatformIds, setIgnoredPlatformIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const isDirty = useMemo(() => {
    const s = resolveSettingsFormState(settings);
    return (
      theme !== s.theme ||
      JSON.stringify(scanPaths) !== JSON.stringify(s.scanPaths) ||
      includeProjectLocal !== s.includeProjectLocal ||
      enableDeepScan !== s.enableDeepScan ||
      dbLocation !== s.dbLocation ||
      trashLocation !== s.trashLocation ||
      JSON.stringify(ignoredPlatformIds) !== JSON.stringify(s.ignoredPlatformIds)
    );
  }, [theme, scanPaths, includeProjectLocal, enableDeepScan, dbLocation, trashLocation, ignoredPlatformIds, settings]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const nextState = resolveSettingsFormState(settings);
    setTheme(nextState.theme);
    setScanPaths(nextState.scanPaths);
    setIncludeProjectLocal(nextState.includeProjectLocal);
    setEnableDeepScan(nextState.enableDeepScan);
    setDbLocation(nextState.dbLocation);
    setTrashLocation(nextState.trashLocation);
    setIgnoredPlatformIds(nextState.ignoredPlatformIds);
  }, [settings]);

  const handleReset = () => {
    const nextState = resolveSettingsFormState(settings);
    setTheme(nextState.theme);
    setScanPaths(nextState.scanPaths);
    setIncludeProjectLocal(nextState.includeProjectLocal);
    setEnableDeepScan(nextState.enableDeepScan);
    setDbLocation(nextState.dbLocation);
    setTrashLocation(nextState.trashLocation);
    setIgnoredPlatformIds(nextState.ignoredPlatformIds);
  };

  const toggleIgnoredPlatform = (platformId: string) => {
    setIgnoredPlatformIds((ids) => (
      ids.includes(platformId)
        ? ids.filter((id) => id !== platformId)
        : [...ids, platformId].sort()
    ));
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
    const nextErrors: Record<string, string> = {};
    scanPaths.forEach((p, i) => {
      if (p.trim()) {
        const err = validatePath(p);
        if (err) nextErrors[`scanPath-${i}`] = err;
      }
    });
    const dbErr = validateDbPath(dbLocation);
    if (dbErr) nextErrors.dbLocation = dbErr;
    const trashErr = validatePath(trashLocation);
    if (trashErr) nextErrors.trashLocation = trashErr;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast('请修正标红的输入项', 'warning');
      return;
    }

    try {
      setSaving(true);
      await onSaveSettings?.({
        theme,
        scanPaths: scanPaths.map((path) => path.trim()).filter(Boolean),
        includeProjectLocal,
        enableDeepScan,
        dbLocation: dbLocation.trim(),
        trashLocation: trashLocation.trim(),
        ignoredPlatformIds,
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
    <div className="flex h-full overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-1 min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 whitespace-nowrap">设置</h2>
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
                  <div className="text-sm font-medium text-gray-700 mb-2 whitespace-nowrap">默认扫描路径</div>
                  <div className="space-y-2">
                    {scanPaths.map((path, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2">
                          <input
                            value={path}
                            onChange={(event) => { updateScanPath(i, event.target.value); setErrors((e) => { const n = { ...e }; delete n[`scanPath-${i}`]; return n; }); }}
                            onBlur={() => { if (path.trim()) { const err = validatePath(path); setErrors((e) => err ? { ...e, [`scanPath-${i}`]: err } : (() => { const n = { ...e }; delete n[`scanPath-${i}`]; return n; })()); } }}
                            className={`flex-1 text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border focus:outline-none ${errors[`scanPath-${i}`] ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-gray-300'}`}
                          />
                          <button
                            onClick={() => removeScanPath(i)}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="移除路径"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {errors[`scanPath-${i}`] && <p className="text-xs text-red-600 mt-1 ml-1">{errors[`scanPath-${i}`]}</p>}
                      </div>
                    ))}
                    <button
                      onClick={addScanPath}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">添加扫描路径</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700 whitespace-nowrap">包含项目本地路径</span>
                    <button
                      role="switch"
                      aria-checked={includeProjectLocal}
                      onClick={() => setIncludeProjectLocal(!includeProjectLocal)}
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ${includeProjectLocal ? 'bg-gray-900' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${includeProjectLocal ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700 whitespace-nowrap">启用深度扫描</span>
                    <button
                      role="switch"
                      aria-checked={enableDeepScan}
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
                <FormField label="SQLite 数据库位置" error={errors.dbLocation}>
                  <input
                    value={dbLocation}
                    onChange={(event) => { setDbLocation(event.target.value); setErrors((e) => { const n = { ...e }; delete n.dbLocation; return n; }); }}
                    onBlur={() => { const err = validateDbPath(dbLocation); setErrors((e) => err ? { ...e, dbLocation: err } : (() => { const n = { ...e }; delete n.dbLocation; return n; })()); }}
                    className={`block w-full text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border focus:outline-none ${errors.dbLocation ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-gray-300'}`}
                  />
                </FormField>
                <FormField label="应用管理回收站位置" error={errors.trashLocation}>
                  <input
                    value={trashLocation}
                    onChange={(event) => { setTrashLocation(event.target.value); setErrors((e) => { const n = { ...e }; delete n.trashLocation; return n; }); }}
                    onBlur={() => { const err = validatePath(trashLocation); setErrors((e) => err ? { ...e, trashLocation: err } : (() => { const n = { ...e }; delete n.trashLocation; return n; })()); }}
                    className={`block w-full text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border focus:outline-none ${errors.trashLocation ? 'border-red-300 focus:border-red-400' : 'border-transparent focus:border-gray-300'}`}
                  />
                </FormField>
              </div>
            </div>

            <div className="section-card">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">平台忽略</h3>
                </div>
              </div>
              <div className="p-5 space-y-2">
                {platforms.filter((platform) => platform.status === 'active').map((platform) => {
                  const ignored = ignoredPlatformIds.includes(platform.id);
                  return (
                    <label key={platform.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-3">
                        <PlatformIcon kind={platform.kind} platformName={platform.name} className="h-8 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800">{platform.name}</span>
                          <span className="block truncate text-xs text-gray-400">{platform.configRoots[0] ?? platform.kind}</span>
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ignored}
                        onClick={() => toggleIgnoredPlatform(platform.id)}
                        className={`h-6 w-11 rounded-full transition-colors duration-200 ${ignored ? 'bg-gray-900' : 'bg-gray-200'}`}
                      >
                        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${ignored ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                  );
                })}
                {platforms.filter((platform) => platform.status === 'active').length === 0 && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">暂无已安装平台</div>
                )}
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
                <div className="text-sm font-medium text-gray-700 mb-3 whitespace-nowrap">主题</div>
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
                        <span className="text-sm font-medium whitespace-nowrap">{t.label}</span>
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
                  <div className="font-medium text-gray-700 mb-1 whitespace-nowrap">安全确认级别</div>
                  <p>所有状态变更操作都需要预览确认。删除操作默认移入回收站，永久删除需要二次确认。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-gray-200/80 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-end gap-3">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              有未保存的更改
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="whitespace-nowrap">重置</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span className="whitespace-nowrap">已保存</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span className="whitespace-nowrap">{saving ? '保存中...' : '保存设置'}</span>
              </>
            )}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
