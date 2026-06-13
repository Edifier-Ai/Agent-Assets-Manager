import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { assetFilters, matchesAssetFilter } from './AssetsPage';

function makeAsset(type: Asset['type'], status: Asset['status'] = ['installed', 'enabled']): Asset {
  return {
    id: `asset-${type}`,
    type,
    name: `${type} asset`,
    description: '',
    author: '',
    version: '',
    source: 'test',
    canonicalHash: '',
    directoryHash: '',
    riskLevel: 'low',
    status,
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    installations: [],
  };
}

describe('asset filters', () => {
  it('includes contextual filters for rules memories and personas', () => {
    expect(assetFilters.map((filter) => filter.id)).toEqual(
      expect.arrayContaining(['Rule', 'Memory', 'Persona']),
    );
  });

  it('matches contextual type filters and status filters', () => {
    expect(matchesAssetFilter(makeAsset('Rule'), 'Rule')).toBe(true);
    expect(matchesAssetFilter(makeAsset('Memory'), 'Memory')).toBe(true);
    expect(matchesAssetFilter(makeAsset('Persona'), 'Persona')).toBe(true);
    expect(matchesAssetFilter(makeAsset('Command'), 'Rule')).toBe(false);
    expect(matchesAssetFilter(makeAsset('Skill', ['installed', 'project-local']), 'project-local')).toBe(true);
  });
});
