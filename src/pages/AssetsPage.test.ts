import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import {
  assetFilters,
  buildInstallOperationRequest,
  groupAssetsByType,
  matchesAssetFilter,
} from './assets';

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

function makeInstalledAsset(type: Asset['type'], path: string): Asset {
  const asset = makeAsset(type);
  return {
    ...asset,
    id: `asset-${type}-installed`,
    name: type === 'Command' ? 'review.md' : `${type} asset`,
    installations: [
      {
        id: `install-${type}`,
        assetId: asset.id,
        platformId: 'codex',
        platformName: 'Codex',
        path,
        scope: 'user',
        enabled: true,
        official: false,
        projectLocal: false,
        bindingType: type.toLowerCase(),
        contentHash: '',
        status: 'ok',
      },
    ],
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

describe('asset card groups', () => {
  it('keeps different asset types in separate card sections', () => {
    const skill = makeAsset('Skill');
    const mcp = makeAsset('MCP Server');
    const command = makeAsset('Command');

    const groups = groupAssetsByType([mcp, skill, command]);

    expect(groups.map((group) => group.id)).toEqual(['Skill', 'Command', 'MCP Server']);
    expect(groups.find((group) => group.id === 'Skill')?.assets).toEqual([skill]);
    expect(groups.find((group) => group.id === 'MCP Server')?.assets).toEqual([mcp]);
  });
});

describe('asset install request builder', () => {
  it('builds a real install operation request for a command target platform', () => {
    const request = buildInstallOperationRequest(
      makeInstalledAsset('Command', '~/.codex/commands/review.md'),
      {
        id: 'kimi',
        name: 'Kimi',
        kind: 'kimi',
        configRoots: ['~/.kimi-code'],
        writable: 'partial',
        status: 'active',
      },
    );

    expect(request).toMatchObject({
      operationType: 'install-asset',
      sourcePath: '~/.codex/commands/review.md',
      targetPath: '~/.kimi-code/commands/review.md',
      platformId: 'kimi',
    });
  });

  it('copies skill folders rather than only the SKILL.md file', () => {
    const request = buildInstallOperationRequest(
      makeInstalledAsset('Skill', '~/.codex/skills/frontend-testing-debugging/SKILL.md'),
      {
        id: 'cursor',
        name: 'Cursor',
        kind: 'cursor',
        configRoots: ['~/.cursor'],
        writable: 'partial',
        status: 'active',
      },
    );

    expect(request?.sourcePath).toBe('~/.codex/skills/frontend-testing-debugging');
    expect(request?.targetPath).toBe('~/.cursor/skills-cursor/Skill-asset');
  });
});
