import { CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { formatDate } from '../utils';

interface StatusBarProps {
  lastScanTime: string;
  onRescan: () => void;
  loading?: boolean;
}

export default function StatusBar({ lastScanTime, onRescan, loading }: StatusBarProps) {
  const scanTimeLabel = lastScanTime ? formatDate(lastScanTime) : '未扫描';

  return (
    <div className="h-12 flex items-center justify-between px-5 border-b border-gray-100 bg-white/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {loading ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        <span>{loading ? '扫描中...' : `上次扫描：${scanTimeLabel}`}</span>
      </div>
      <button
        onClick={onRescan}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        {loading ? '扫描中' : '重新扫描'}
      </button>
    </div>
  );
}
