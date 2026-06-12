import { Home, Box, Layers, Brain, ScanLine, Archive, Settings, Briefcase } from 'lucide-react';
import type { NavPage } from '../types';

interface SidebarProps {
  active: NavPage;
  onNavigate: (page: NavPage) => void;
}

const items: { id: NavPage; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: '概览', icon: Home },
  { id: 'assets', label: '资产', icon: Box },
  { id: 'platforms', label: '平台', icon: Layers },
  { id: 'models', label: '模型', icon: Brain },
  { id: 'scan', label: '扫描', icon: ScanLine },
  { id: 'backups', label: '备份', icon: Archive },
  { id: 'settings', label: '设置', icon: Settings },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <div className="w-56 bg-sidebar flex flex-col border-r border-gray-200/60 select-none shrink-0">
      <div className="p-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
          <Briefcase className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-900 tracking-tight">Agent Assets Manager</span>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full text-left ${isActive ? 'active' : ''}`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-gray-900' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200/60">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>本地扫描完成</span>
        </div>
        <div className="mt-1 text-xs text-gray-400 pl-4">128 资产已索引</div>
      </div>
    </div>
  );
}
