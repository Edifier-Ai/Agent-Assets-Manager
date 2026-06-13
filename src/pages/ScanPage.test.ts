import { describe, it, expect } from 'vitest';
import { buildScanChangeSummary, isScanRunComplete } from './ScanPage';
import { formatDate } from '../utils';

describe('formatDate (replaces formatScanTime)', () => {
  it('formats an ISO timestamp into a readable string', () => {
    const result = formatDate('2024-03-15T09:05:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns different strings for different timestamps', () => {
    const a = formatDate('2024-01-01T00:00:00.000Z');
    const b = formatDate('2024-06-15T12:30:00.000Z');
    expect(a).not.toBe(b);
  });
});

describe('isScanRunComplete', () => {
  it('returns true when status is completed', () => {
    expect(isScanRunComplete({ status: 'completed' })).toBe(true);
  });

  it('returns false when status is running', () => {
    expect(isScanRunComplete({ status: 'running' })).toBe(false);
  });

  it('returns false when status is failed', () => {
    expect(isScanRunComplete({ status: 'failed' })).toBe(false);
  });
});

describe('buildScanChangeSummary', () => {
  it('explains how the latest scan changed from the previous scan', () => {
    expect(buildScanChangeSummary(
      {
        assetsFound: 18,
        platformsFound: 5,
        duplicatesFound: 2,
        warningsFound: 3,
      },
      {
        assetsFound: 12,
        platformsFound: 4,
        duplicatesFound: 5,
        warningsFound: 1,
      },
    )).toEqual([
      '资产 +6',
      '平台 +1',
      '重复 -3',
      '风险提示 +2',
    ]);
  });

  it('returns a first-scan explanation when no previous run exists', () => {
    expect(buildScanChangeSummary({ assetsFound: 3, platformsFound: 2, duplicatesFound: 0, warningsFound: 0 }, undefined))
      .toEqual(['首次扫描建立本机资产基线']);
  });
});
