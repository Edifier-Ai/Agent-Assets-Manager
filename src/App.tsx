import { useState, useCallback, useEffect, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WindowChrome from './components/WindowChrome';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import DetailPanel from './components/DetailPanel';
import OverviewPage from './pages/OverviewPage';
import AssetsPage from './pages/AssetsPage';
import PlatformsPage from './pages/PlatformsPage';
import ModelsPage from './pages/ModelsPage';
import ScanPage from './pages/ScanPage';
import BackupsPage from './pages/BackupsPage';
import SettingsPage from './pages/SettingsPage';
import FirstRunWizard from './components/FirstRunWizard';
import { ToastProvider } from './components/Toast';
import * as api from './api';
import type {
  NavPage,
  Platform,
  Asset,
  ModelBinding,
  Backup,
  Finding,
  ScanRun,
  AppSettings,
  SaveSettingsInput,
} from './types';

const pageComponents: Record<NavPage, ComponentType<any>> = {
  overview: OverviewPage,
  assets: AssetsPage,
  platforms: PlatformsPage,
  models: ModelsPage,
  scan: ScanPage,
  backups: BackupsPage,
  settings: SettingsPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [firstRun, setFirstRun] = useState(false);

  // Data states
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [modelBindings, setModelBindings] = useState<ModelBinding[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanRuns, setScanRuns] = useState<ScanRun[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [p, a, m, b, f, r, s] = await Promise.all([
        api.getPlatforms(),
        api.getAssets(),
        api.getModelBindings(),
        api.getBackups(),
        api.getFindings(),
        api.getScanRuns(),
        api.getSettings(),
      ]);
      setPlatforms(p);
      setAssets(a);
      setModelBindings(m);
      setBackups(b);
      setFindings(f);
      setScanRuns(r);
      setSettings(s);
      if (r.length > 0) {
        setLastScanTime(r[0].completedAt || r[0].startedAt || '');
      } else {
        setLastScanTime('');
      }

      const hasCompletedScan = r.some((run) => run.status === 'completed');
      setFirstRun(!hasCompletedScan);
    } catch (e) {
      console.error('Failed to load data:', e);
      setFirstRun(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNavigate = useCallback((page: NavPage) => {
    setCurrentPage(page);
    setSelectedPlatform(null);
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
      console.error('Scan failed:', e);
    }
    setLoading(false);
    setCurrentPage('scan');
  }, [loadData]);

  const handleCloseDetail = useCallback(() => {
    setSelectedPlatform(null);
  }, []);

  const handleWizardComplete = useCallback(async () => {
    setLoading(true);
    try {
      await loadData();
    } catch (e) {
      console.error('Failed to refresh after initial scan:', e);
    } finally {
      setLoading(false);
    }
    setFirstRun(false);
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const handleSaveSettings = useCallback(async (nextSettings: SaveSettingsInput) => {
    await api.saveSettings(nextSettings);
    const refreshed = await api.getSettings();
    setSettings(refreshed);
  }, []);

  const PageComponent = pageComponents[currentPage];

  const pageProps = {
    platforms,
    assets,
    modelBindings,
    backups,
    findings,
    scanRuns,
    settings: settings ?? undefined,
    onSelectPlatform: handleSelectPlatform,
    onRefresh: handleRefresh,
    onSaveSettings: handleSaveSettings,
  };

  return (
    <ToastProvider>
      <div className="h-screen w-screen flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl">
        <WindowChrome />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar active={currentPage} onNavigate={handleNavigate} />
          <div className="flex-1 flex flex-col min-w-0">
            <StatusBar lastScanTime={lastScanTime} onRescan={handleRescan} loading={loading} />
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
    </ToastProvider>
  );
}
