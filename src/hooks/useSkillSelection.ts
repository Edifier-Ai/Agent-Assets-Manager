import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Asset } from '../types';

export function useSkillSelection(assets: Asset[]) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const skillAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'Skill'),
    [assets],
  );

  const selectedSkills = useMemo(
    () => skillAssets.filter((skill) => selectedIds.has(skill.id)),
    [skillAssets, selectedIds],
  );

  useEffect(() => {
    const visibleIds = new Set(skillAssets.map((skill) => skill.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [skillAssets]);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((asset: Asset) => {
    if (asset.type !== 'Skill') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = skillAssets.map((s) => s.id);
    setSelectedIds(new Set(allIds));
  }, [skillAssets]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (assetId: string) => selectedIds.has(assetId),
    [selectedIds],
  );

  const selectCount = selectedIds.size;
  const totalSkillCount = skillAssets.length;
  const allSelected = selectCount > 0 && selectCount === totalSkillCount;
  const someSelected = selectCount > 0 && selectCount < totalSkillCount;

  return {
    isSelectionMode,
    selectedIds,
    selectedSkills,
    selectCount,
    totalSkillCount,
    allSelected,
    someSelected,
    toggleSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
  };
}
