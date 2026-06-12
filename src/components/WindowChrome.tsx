import { Wifi, Battery } from 'lucide-react';

export default function WindowChrome() {
  return (
    <div className="window-chrome shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-mac-red" />
        <div className="w-3 h-3 rounded-full bg-mac-yellow" />
        <div className="w-3 h-3 rounded-full bg-mac-green" />
      </div>
      <div className="flex-1 text-center">
        <span className="text-sm font-medium text-gray-500">Agent Assets Manager</span>
      </div>
      <div className="flex items-center gap-3 text-gray-400">
        <Wifi className="w-4 h-4" />
        <Battery className="w-4 h-4" />
      </div>
    </div>
  );
}
