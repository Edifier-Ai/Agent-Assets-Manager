import { describe, expect, it } from 'vitest';
import { buildDiagnosticsSummary, sortDiagnostics } from './DiagnosticsPage';
import type { Finding, ModelBinding } from '../types';

function finding(id: string, riskLevel: Finding['riskLevel'], issue: string): Finding {
  return {
    id,
    assetId: `asset-${id}`,
    assetName: `Asset ${id}`,
    platformId: 'codex',
    platformName: 'Codex',
    issue,
    riskLevel,
    detail: `${issue} detail`,
  };
}

describe('diagnostics summary', () => {
  it('combines scan findings and model warnings into actionable counts', () => {
    const bindings: ModelBinding[] = [
      {
        id: 'model-1',
        platformId: 'kimi',
        platformName: 'Kimi',
        detectedProvider: 'Moonshot',
        detectedModelId: 'kimi-k2',
        detectedBaseUrl: 'https://api.moonshot.cn',
        configPath: '~/.kimi-code/config.json',
        keyPresence: false,
        keyStorage: 'unknown',
        validationStatus: 'warning',
        lastValidatedAt: '2026-06-13T00:00:00Z',
        warnings: ['缺少 API Key'],
      },
    ];

    expect(buildDiagnosticsSummary([
      finding('high', 'high', 'Secret'),
      finding('medium', 'medium', 'Conflict'),
    ], bindings)).toEqual({
      total: 3,
      highRisk: 1,
      mediumRisk: 2,
      modelWarnings: 1,
    });
  });

  it('sorts high-risk diagnostics before lower-risk items', () => {
    expect(sortDiagnostics([
      finding('low', 'low', 'Project-local'),
      finding('high', 'high', 'Secret'),
      finding('medium', 'medium', 'Conflict'),
    ]).map((item) => item.id)).toEqual(['high', 'medium', 'low']);
  });
});
