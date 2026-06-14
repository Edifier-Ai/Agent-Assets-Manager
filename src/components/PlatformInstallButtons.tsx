import { CheckCircle2, Download, Plus } from 'lucide-react';
import PlatformIcon from './PlatformIcon';
import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';
import { isInstalledOnPlatform } from '../pages/assets/logic';

interface PlatformInstallButtonsProps {
  asset: Asset;
  availablePlatformTargets: PlatformTarget[];
  onInstallClick: (asset: Asset, target?: PlatformTarget) => void;
  compact?: boolean;
}

export default function PlatformInstallButtons({
  asset,
  availablePlatformTargets,
  onInstallClick,
  compact = false,
}: PlatformInstallButtonsProps) {
  const sizeClass = compact ? 'h-8 w-8' : 'h-9 w-9';
  const platformIconClass = compact ? 'h-7 w-7' : 'h-8 w-8';
  const actionIconClass = compact ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-1.5">
      {availablePlatformTargets.map((target) => {
        const installed = isInstalledOnPlatform(asset, target);
        return (
          <button
            key={target.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onInstallClick(asset, target);
            }}
            aria-pressed={installed}
            className={`relative flex items-center justify-center rounded-lg border transition-all ${sizeClass} ${
              installed
                ? 'border-gray-200 bg-gray-900 text-white shadow-sm'
                : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600'
            }`}
            title={installed ? `已安装于 ${target.name}` : `点击安装到 ${target.name}`}
            aria-label={installed ? `已安装于 ${target.name}` : `安装到 ${target.name}`}
          >
            <PlatformIcon
              kind={target.kind}
              platformName={target.name}
              className={`${platformIconClass} rounded-md transition-all ${
                installed
                  ? 'opacity-100'
                  : 'opacity-60'
              }`}
            />
            {installed ? (
              <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-green-600" />
            ) : (
              <Download className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onInstallClick(asset);
        }}
        className={`${sizeClass} flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white text-gray-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors`}
        title="安装到全部平台"
        aria-label="安装到全部平台"
      >
        <Plus className={actionIconClass} />
      </button>
    </div>
  );
}
