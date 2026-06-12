import { useState, useCallback } from 'react';
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
import { lastScanRun } from './data/mockData';
import type { NavPage, Platform } from './types';

const pageComponents: Record<NavPage, React.ComponentType<any>> = {
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
  const [lastScanTime] = useState(lastScanRun.completedAt || lastScanRun.startedAt);
  const [firstRun, setFirstRun] = useState(true);

  const handleNavigate = useCallback((page: NavPage) => {
    setCurrentPage(page);
    setSelectedPlatform(null);
  }, []);

  const handleSelectPlatform = useCallback((p: Platform) => {
    setSelectedPlatform(p);
  }, []);

  const handleRescan = useCallback(() => {
    setCurrentPage('scan');
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPlatform(null);
  }, []);

  const handleWizardComplete = useCallback(() => {
    setFirstRun(false);
  }, []);

  const PageComponent = pageComponents[currentPage];

  return (
    <ToastProvider>
      <div className="h-screen w-screen flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl">
        <WindowChrome />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar active={currentPage} onNavigate={handleNavigate} />
          <div className="flex-1 flex flex-col min-w-0">
            <StatusBar lastScanTime={lastScanTime} onRescan={handleRescan} />
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
                    <PageComponent
                      onSelectPlatform={handleSelectPlatform}
                    />
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
