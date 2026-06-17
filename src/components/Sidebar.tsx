import { Home, Box, Layers, Brain, ScanLine, Archive, History, Settings, ShieldAlert } from 'lucide-react';
import PlatformIcon from './PlatformIcon';
import type { NavPage, ScanRun } from '../types';

interface SidebarProps {
  active: NavPage;
  onNavigate: (page: NavPage) => void;
  latestScanRun?: ScanRun;
  scanning?: boolean;
}

const items: { id: NavPage; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: '概览', icon: Home },
  { id: 'assets', label: '资产', icon: Box },
  { id: 'platforms', label: '平台', icon: Layers },
  { id: 'models', label: '模型', icon: Brain },
  { id: 'diagnostics', label: '问题中心', icon: ShieldAlert },
  { id: 'scan', label: '扫描', icon: ScanLine },
  { id: 'backups', label: '备份', icon: Archive },
  { id: 'operations', label: '操作历史', icon: History },
  { id: 'settings', label: '设置', icon: Settings },
];

function getScanStatusLabel(latestScanRun?: ScanRun, scanning?: boolean): string {
  if (scanning || latestScanRun?.status === 'running') {
    return '本地扫描中';
  }
  if (!latestScanRun) {
    return '暂无扫描记录';
  }
  return latestScanRun.status === 'completed' ? '本地扫描完成' : '扫描失败';
}

function getScanCountLabel(latestScanRun?: ScanRun): string {
  if (!latestScanRun) {
    return '暂无资产索引';
  }
  return `${latestScanRun.assetsFound} 资产已索引`;
}

export default function Sidebar({ active, onNavigate, latestScanRun, scanning }: SidebarProps) {
  const scanStatusLabel = getScanStatusLabel(latestScanRun, scanning);
  const scanCountLabel = getScanCountLabel(latestScanRun);

  return (
    <div className="w-56 bg-sidebar flex flex-col border-r border-gray-200/60 select-none shrink-0">
      <div className="p-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
          <PlatformIcon kind="app" className="w-7 h-7" />
        </div>
        <span className="font-semibold text-sm text-gray-900 tracking-tight whitespace-nowrap">Agent Assets Manager</span>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="主导航">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`nav-item w-full text-left ${isActive ? 'active' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-gray-900' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200/60">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="whitespace-nowrap">{scanStatusLabel}</span>
        </div>
        <div className="mt-1 text-xs text-gray-400 pl-4 whitespace-nowrap">{scanCountLabel}</div>
      </div>
    </div>
  );
}
