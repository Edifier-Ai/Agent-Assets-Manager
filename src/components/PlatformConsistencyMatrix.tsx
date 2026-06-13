import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';
import { normalizePlatform } from '../pages/assets/logic';
import PlatformIcon from './PlatformIcon';
import Tooltip from './Tooltip';

type PlatformStatus = 'consistent' | 'missing' | 'different' | 'readonly' | 'unsupported';

export interface ConsistencyMatrix {
  statuses: Record<string, PlatformStatus>;
  hasInconsistencies: boolean;
}

export function computePlatformConsistency(
  asset: Asset,
  availablePlatformTargets: PlatformTarget[],
): ConsistencyMatrix {
  const statuses: Record<string, PlatformStatus> = {};
  let hasInconsistencies = false;

  for (const target of availablePlatformTargets) {
    const normalizedTargetId = normalizePlatform(target.id);

    // Check if platform is readonly (can't install)
    if (target.writable === 'readonly') {
      statuses[target.id] = 'readonly';
      hasInconsistencies = true;
      continue;
    }

    // Check if installed
    const installation = asset.installations.find((inst) => {
      const instId = normalizePlatform(inst.platformId);
      const instName = normalizePlatform(inst.platformName);
      return instId.includes(normalizedTargetId) || instName.includes(normalizedTargetId);
    });

    if (!installation) {
      statuses[target.id] = 'missing';
      hasInconsistencies = true;
      continue;
    }

    // Check if content hash matches canonical
    const assetHash = asset.canonicalHash || asset.directoryHash;
    const instHash = installation.contentHash;

    if (assetHash && instHash && assetHash !== instHash) {
      statuses[target.id] = 'different';
      hasInconsistencies = true;
      continue;
    }

    statuses[target.id] = 'consistent';
  }

  return { statuses, hasInconsistencies };
}

const statusConfig: Record<PlatformStatus, { label: string; bgClass: string; borderClass: string; textClass: string }> = {
  consistent: {
    label: '已一致',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-600',
  },
  missing: {
    label: '缺失',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-400',
  },
  different: {
    label: '内容不同',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-600',
  },
  readonly: {
    label: '只读',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-400',
  },
  unsupported: {
    label: '不支持',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    textClass: 'text-red-500',
  },
};

interface PlatformConsistencyMatrixProps {
  asset: Asset;
  availablePlatformTargets: PlatformTarget[];
  compact?: boolean;
}

export default function PlatformConsistencyMatrix({
  asset,
  availablePlatformTargets,
  compact = false,
}: PlatformConsistencyMatrixProps) {
  const { statuses, hasInconsistencies } = computePlatformConsistency(asset, availablePlatformTargets);

  if (!hasInconsistencies && availablePlatformTargets.length > 0) {
    // If all consistent, show a compact success indicator
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          全平台一致
        </span>
      </div>
    );
  }

  const size = compact ? 'h-5 w-5' : 'h-6 w-6';
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="flex items-center gap-1">
      {availablePlatformTargets.map((target) => {
        const status = statuses[target.id] ?? 'missing';
        const config = statusConfig[status];

        return (
          <Tooltip key={target.id} content={`${target.name}: ${config.label}`}>
            <span
              className={`inline-flex items-center justify-center rounded-md border ${size} ${config.bgClass} ${config.borderClass}`}
            >
              <PlatformIcon
                kind={target.kind}
                platformName={target.name}
                className={`${iconSize} ${config.textClass}`}
              />
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
