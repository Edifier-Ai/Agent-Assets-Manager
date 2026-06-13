import { CheckCircle2, Plus } from 'lucide-react';
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
            className={`relative flex items-center justify-center rounded-lg border transition-colors ${
              compact ? 'h-8 w-8' : 'h-9 w-9'
            } ${
              installed
                ? 'border-gray-200 bg-gray-900 text-white shadow-sm'
                : 'border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400 hover:bg-gray-50'
            }`}
            title={`${installed ? '已安装于' : '添加到'} ${target.name}`}
            aria-label={`${installed ? '已安装于' : '安装到'} ${target.name}`}
          >
            <PlatformIcon kind={target.kind} platformName={target.name} className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            {installed && (
              <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-green-600" />
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
        className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors`}
        title="添加到全部平台"
        aria-label="添加到全部平台"
      >
        <Plus className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
    </div>
  );
}
