import { CheckSquare, Square, X, ArrowRightLeft, ArrowDownToLine } from 'lucide-react';
import type { Asset } from '../types';
import type { PlatformTarget } from '../pages/assets/constants';
import { computePlatformConsistency } from './PlatformConsistencyMatrix';
import { normalizePlatform } from '../pages/assets/logic';

export type BatchAction = 'install-all' | 'sync-from-source' | null;

interface SelectionBatchBarProps {
  selectedSkills: Asset[];
  selectCount: number;
  totalSkillCount: number;
  allSelected: boolean;
  availablePlatformTargets: PlatformTarget[];
  sourcePlatformId?: string;
  onSourcePlatformChange: (platformId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExitSelectionMode: () => void;
  onBatchAction: (action: BatchAction) => void;
  busy?: boolean;
}

export default function SelectionBatchBar({
  selectedSkills,
  selectCount,
  totalSkillCount,
  allSelected,
  availablePlatformTargets,
  sourcePlatformId,
  onSourcePlatformChange,
  onSelectAll,
  onDeselectAll,
  onExitSelectionMode,
  onBatchAction,
  busy = false,
}: SelectionBatchBarProps) {
  // Determine the best source platform for sync (a platform where most skills are installed)
  const platformInstallCounts = availablePlatformTargets.map((target) => {
    const normalizedId = normalizePlatform(target.id);
    const count = selectedSkills.filter((skill) =>
      skill.installations.some((inst) => {
        const instId = normalizePlatform(inst.platformId);
        const instName = normalizePlatform(inst.platformName);
        return instId.includes(normalizedId) || instName.includes(normalizedId);
      }),
    ).length;
    return { target, count };
  });

  const bestSourcePlatform = platformInstallCounts.reduce<typeof platformInstallCounts[number] | undefined>(
    (best, current) => (!best || current.count > best.count ? current : best),
    undefined,
  );
  const selectedSource = sourcePlatformId
    ? platformInstallCounts.find((item) => item.target.id === sourcePlatformId)
    : bestSourcePlatform;
  const syncDisabled = busy || selectCount === 0 || !selectedSource || selectedSource.count === 0;

  // Check if any selected skills have inconsistent content across platforms
  const hasInconsistencies = selectedSkills.some((skill) => {
    const { hasInconsistencies: hi } = computePlatformConsistency(skill, availablePlatformTargets);
    return hi;
  });

  return (
    <div className="sticky top-0 z-30 border-b border-blue-100 bg-blue-50/90 px-5 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
            disabled={busy}
          >
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            <span>
              已选 {selectCount} / {totalSkillCount} 项
            </span>
          </button>

          <label className="flex items-center gap-1.5 text-xs text-blue-700">
            <span className="whitespace-nowrap">来源平台</span>
            <select
              value={selectedSource?.target.id ?? ''}
              onChange={(event) => onSourcePlatformChange(event.target.value)}
              disabled={busy || selectCount === 0}
              className="h-8 rounded-md border border-blue-200 bg-white px-2 text-xs font-medium text-blue-800 outline-none focus:border-blue-400"
            >
              {platformInstallCounts.map(({ target, count }) => (
                <option key={target.id} value={target.id}>
                  {target.name} ({count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {hasInconsistencies && (
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-700">
              存在内容不一致
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onBatchAction('install-all')}
              disabled={busy || selectCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="把所选 Skills 安装到所有可写的目标平台（只补缺失）"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">安装到全部平台</span>
            </button>

            <button
              onClick={() => onBatchAction('sync-from-source')}
              disabled={syncDisabled}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="以来源平台为准同步到其他平台（冲突默认跳过）"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">
                从 {selectedSource?.target.name ?? '来源'} 同步
              </span>
            </button>
          </div>

          <button
            onClick={onExitSelectionMode}
            className="rounded-lg p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
            title="退出选择模式"
            disabled={busy}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
