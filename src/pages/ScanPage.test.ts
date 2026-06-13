import { describe, it, expect } from 'vitest';
import { formatScanTime, isScanRunComplete } from './ScanPage';

describe('formatScanTime', () => {
  it('formats an ISO timestamp into a zh-CN locale string', () => {
    const result = formatScanTime('2024-03-15T09:05:00.000Z');
    // Result should be a non-empty string derived from the date
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns different strings for different timestamps', () => {
    const a = formatScanTime('2024-01-01T00:00:00.000Z');
    const b = formatScanTime('2024-06-15T12:30:00.000Z');
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
