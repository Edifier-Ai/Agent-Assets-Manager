import { Filter, Grid2X2, List, Plus, Search, X } from 'lucide-react';
import Tooltip from './Tooltip';
import type { AssetFilterId } from '../types';
import { assetFilters } from '../pages/assets/constants';

interface AssetToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  viewMode: 'list' | 'cards';
  onViewModeChange: (mode: 'list' | 'cards') => void;
  activeFilter: AssetFilterId;
  onFilterChange: (filter: AssetFilterId) => void;
}

export default function AssetToolbar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  activeFilter,
  onFilterChange,
}: AssetToolbarProps) {
  return (
    <div className="border-b border-gray-100 bg-white/70 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">资产库</h2>
          <p className="mt-0.5 text-xs text-gray-500 whitespace-nowrap">按类型管理本机 Agent 资产 SKU</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索资产或路径"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                aria-label="清除搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <Tooltip content="筛选">
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              <span className="whitespace-nowrap">筛选</span>
            </button>
          </Tooltip>
          <div className="flex h-9 rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="视图模式">
            <button
              onClick={() => onViewModeChange('list')}
              aria-pressed={viewMode === 'list'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${
                viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <List className="h-4 w-4" />
              <span className="whitespace-nowrap">列表</span>
            </button>
            <button
              onClick={() => onViewModeChange('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`flex items-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${
                viewMode === 'cards' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Grid2X2 className="h-4 w-4" />
              <span className="whitespace-nowrap">卡片</span>
            </button>
          </div>
          <button className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">新增资产</span>
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-max items-center gap-2" role="radiogroup" aria-label="资产类型筛选">
          {assetFilters.map((filter) => (
            <button
              key={filter.id}
              role="radio"
              aria-checked={activeFilter === filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`filter-chip ${activeFilter === filter.id ? 'active' : 'bg-gray-50 text-gray-600'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
