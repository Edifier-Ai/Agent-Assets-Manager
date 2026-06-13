export default function WindowChrome() {
  return (
    <div className="window-chrome relative shrink-0" data-tauri-drag-region>
      <div className="relative z-10 flex items-center gap-2" data-tauri-drag-region>
        <div className="w-3 h-3 rounded-full bg-mac-red" />
        <div className="w-3 h-3 rounded-full bg-mac-yellow" />
        <div className="w-3 h-3 rounded-full bg-mac-green" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 text-center" data-tauri-drag-region>
        <span className="text-sm font-medium text-gray-500" data-tauri-drag-region>
          Agent Assets Manager
        </span>
      </div>
    </div>
  );
}
