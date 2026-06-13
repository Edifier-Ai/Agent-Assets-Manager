import { Wifi, Battery } from 'lucide-react';

export default function WindowChrome() {
  return (
    <div className="window-chrome shrink-0" data-tauri-drag-region>
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <div className="w-3 h-3 rounded-full bg-mac-red" />
        <div className="w-3 h-3 rounded-full bg-mac-yellow" />
        <div className="w-3 h-3 rounded-full bg-mac-green" />
      </div>
      <div className="flex-1 text-center" data-tauri-drag-region>
        <span className="text-sm font-medium text-gray-500" data-tauri-drag-region>
          Agent Assets Manager
        </span>
      </div>
      <div className="flex items-center gap-3 text-gray-400" data-tauri-drag-region>
        <Wifi className="w-4 h-4" />
        <Battery className="w-4 h-4" />
      </div>
    </div>
  );
}
