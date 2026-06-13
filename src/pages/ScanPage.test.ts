import { describe, it, expect } from 'vitest';
import { isScanRunComplete } from './ScanPage';
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
