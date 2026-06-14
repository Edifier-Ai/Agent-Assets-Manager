import { useState, useCallback, useEffect, useMemo, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WindowChrome from './components/WindowChrome';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import DetailPanel from './components/DetailPanel';
import ConfirmDialog from './components/ConfirmDialog';
import OverviewPage from './pages/OverviewPage';
import AssetsPage from './pages/assets';
import PlatformsPage from './pages/PlatformsPage';
import ModelsPage from './pages/ModelsPage';
import DiagnosticsPage from './pages/DiagnosticsPage';
import ScanPage from './pages/ScanPage';
import BackupsPage from './pages/BackupsPage';
import OperationsPage from './pages/OperationsPage';
import SettingsPage, { applyThemePreference } from './pages/SettingsPage';
import FirstRunWizard from './components/FirstRunWizard';
import { ToastProvider, useToast } from './components/Toast';
import * as api from './api';
import { isInstalledOnPlatform } from './pages/assets/logic';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type {
  NavPage,
  AssetFilterId,
  Platform,
  Asset,
  ModelBinding,
  Backup,
  Finding,
  OperationLog,
  ScanRun,
  AppSettings,
  SaveSettingsInput,
} from './types';

interface FilterIgnoredPlatformDataInput {
  platforms: Platform[];
  assets: Asset[];
  modelBindings: ModelBinding[];
  findings: Finding[];
  settings?: AppSettings | null;
}

export function filterIgnoredPlatformData({
  platforms,
  assets,
  modelBindings,
  findings,
  settings,
}: FilterIgnoredPlatformDataInput): Pick<FilterIgnoredPlatformDataInput, 'platforms' | 'assets' | 'modelBindings' | 'findings'> {
  const ignoredIds = new Set(settings?.ignoredPlatformIds ?? []);
  if (ignoredIds.size === 0) {
    return { platforms, assets, modelBindings, findings };
  }

  const ignoredPlatforms = platforms.filter((platform) => ignoredIds.has(platform.id));
  const visiblePlatforms = platforms.filter((platform) => !ignoredIds.has(platform.id));
  const isIgnoredInstallation = (asset: Asset, installationId: string) => {
    const installation = asset.installations.find((item) => item.id === installationId);
    if (!installation) return false;
    if (ignoredIds.has(installation.platformId)) return true;
    const singleInstallAsset = { ...asset, installations: [installation] };
    return ignoredPlatforms.some((platform) => isInstalledOnPlatform(singleInstallAsset, platform));
  };

  const visibleAssets = assets
    .map((asset) => ({
      ...asset,
      installations: asset.installations.filter((installation) => !isIgnoredInstallation(asset, installation.id)),
    }))
    .filter((asset) => asset.installations.length > 0);

  return {
    platforms: visiblePlatforms,
    assets: visibleAssets,
    modelBindings: modelBindings.filter((binding) => !ignoredIds.has(binding.platformId)),
    findings: findings.filter((finding) => !ignoredIds.has(finding.platformId)),
  };
}

const pageComponents: Record<NavPage, ComponentType<any>> = {
  overview: OverviewPage,
  assets: AssetsPage,
  platforms: PlatformsPage,
  models: ModelsPage,
  diagnostics: DiagnosticsPage,
  scan: ScanPage,
  backups: BackupsPage,
  operations: OperationsPage,
  settings: SettingsPage,
};

function getErrorMessage(error: unknown, defaultMessage: string): string {
  return error instanceof Error && error.message ? error.message : defaultMessage;
}

function UnsupportedRuntimeState() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">当前运行在浏览器壳中</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前环境不会读取任何本机业务数据，应用已移除浏览器演示数据路径。
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          仅 Tauri 桌面应用支持真实数据、扫描、设置保存和批量操作预览。
        </p>
        <div className="mt-5 rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100">
          npm run tauri dev
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [assetInitialFilter, setAssetInitialFilter] = useState<AssetFilterId>('all');
  const [firstRun, setFirstRun] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ page: NavPage; options?: { assetFilter?: AssetFilterId } } | null>(null);
  const { showToast } = useToast();

  // Data states
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [modelBindings, setModelBindings] = useState<ModelBinding[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [scanRuns, setScanRuns] = useState<ScanRun[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [p, a, m, b, f, ol, r, s] = await Promise.all([
        api.getPlatforms(),
        api.getAssets(),
        api.getModelBindings(),
        api.getBackups(),
        api.getFindings(),
        api.getOperationLogs(),
        api.getScanRuns(),
        api.getSettings(),
      ]);
      setPlatforms(p);
      setAssets(a);
      setModelBindings(m);
      setBackups(b);
      setFindings(f);
      setOperationLogs(ol);
      setScanRuns(r);
      setSettings(s);
      if (r.length > 0) {
        setLastScanTime(r[0].completedAt || r[0].startedAt || '');
      } else {
        setLastScanTime('');
      }

      const hasCompletedScan = r.some((run) => run.status === 'completed');
      setFirstRun(!hasCompletedScan);
      setLoadError(null);
    } catch (e) {
      const message = getErrorMessage(e, '无法加载本机资产数据');
      setLoadError(message);
      showToast(`加载失败：${message}`, 'error');
    } finally {
      setInitialLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const applyCurrentTheme = () => {
      applyThemePreference(settings?.theme ?? 'system', root, mediaQuery?.matches ?? false);
    };

    applyCurrentTheme();

    if (!mediaQuery || settings?.theme !== 'system') {
      return undefined;
    }

    const handleSystemThemeChange = () => {
      applyCurrentTheme();
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, [settings?.theme]);

  const handleNavigate = useCallback((page: NavPage, options?: { assetFilter?: AssetFilterId }) => {
    if (settingsDirty && currentPage === 'settings' && page !== 'settings') {
      setPendingNavigation({ page, options });
      return;
    }
    setCurrentPage(page);
    setSelectedPlatform(null);
    if (page === 'assets') {
      setAssetInitialFilter(options?.assetFilter ?? 'all');
    }
  }, [settingsDirty, currentPage]);

  const confirmNavigation = useCallback(() => {
    if (pendingNavigation) {
      setCurrentPage(pendingNavigation.page);
      setSelectedPlatform(null);
      if (pendingNavigation.page === 'assets') {
        setAssetInitialFilter(pendingNavigation.options?.assetFilter ?? 'all');
      }
      setPendingNavigation(null);
      setSettingsDirty(false);
    }
  }, [pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const handleSelectPlatform = useCallback((p: Platform) => {
    setSelectedPlatform(p);
  }, []);

  const handleRescan = useCallback(async () => {
    setLoading(true);
    try {
      await api.scanAssets();
      await loadData();
    } catch (e) {
      const message = getErrorMessage(e, '扫描失败');
      setLoadError(message);
      showToast(`扫描失败：${message}`, 'error');
    } finally {
      setLoading(false);
      setCurrentPage('scan');
    }
  }, [loadData, showToast]);

  const handleCloseDetail = useCallback(() => {
    setSelectedPlatform(null);
  }, []);

  const handleWizardComplete = useCallback(async () => {
    setLoading(true);
    try {
      await loadData();
    } catch (e) {
      const message = getErrorMessage(e, '初次扫描后刷新失败');
      setLoadError(message);
      showToast(`刷新失败：${message}`, 'error');
    } finally {
      setLoading(false);
    }
    setFirstRun(false);
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const handleSaveSettings = useCallback(async (nextSettings: SaveSettingsInput) => {
    try {
      await api.saveSettings(nextSettings);
      const refreshed = await api.getSettings();
      setSettings(refreshed);
      setLoadError(null);
      showToast('设置已保存', 'success');
    } catch (e) {
      const message = getErrorMessage(e, '设置保存失败');
      setLoadError(message);
      showToast(`保存失败：${message}`, 'error');
      throw e;
    }
  }, [showToast]);

  const PageComponent = pageComponents[currentPage];
  const visibleData = useMemo(() => filterIgnoredPlatformData({
    platforms,
    assets,
    modelBindings,
    findings,
    settings,
  }), [platforms, assets, modelBindings, findings, settings]);

  const pageProps = {
    platforms: currentPage === 'settings' ? platforms : visibleData.platforms,
    assets: visibleData.assets,
    modelBindings: visibleData.modelBindings,
    backups,
    findings: visibleData.findings,
    operationLogs,
    scanRuns,
    settings: settings ?? undefined,
    initialFilter: currentPage === 'assets' ? assetInitialFilter : undefined,
    initialLoading,
    onSelectPlatform: handleSelectPlatform,
    onNavigate: handleNavigate,
    onRefresh: handleRefresh,
    onSaveSettings: handleSaveSettings,
    onDirtyChange: currentPage === 'settings' ? setSettingsDirty : undefined,
  };

  return (
    <>
      <div className="h-screen w-screen flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl">
        <WindowChrome />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            active={currentPage}
            onNavigate={handleNavigate}
            latestScanRun={scanRuns[0]}
            scanning={loading}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <StatusBar lastScanTime={lastScanTime} onRescan={handleRescan} loading={loading} />
            {loadError && (
              <div
                role="alert"
                className="mx-5 mt-4 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="truncate">数据加载失败：{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重试
                </button>
              </div>
            )}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="h-full"
                  >
                    <PageComponent {...pageProps} />
                  </motion.div>
                </AnimatePresence>
              </div>
              {currentPage === 'overview' && (
                <DetailPanel platform={selectedPlatform} onClose={handleCloseDetail} />
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {firstRun && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FirstRunWizard onComplete={handleWizardComplete} />
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!pendingNavigation}
        title="离开设置页？"
        description="有未保存的设置更改，离开后更改将丢失。"
        confirmLabel="离开"
        cancelLabel="留在此页"
        variant="warning"
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </>
  );
}

export default function App() {
  if (!api.isTauriRuntime()) {
    return (
      <ToastProvider>
        <UnsupportedRuntimeState />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
