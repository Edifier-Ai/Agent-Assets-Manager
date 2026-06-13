import { describe, it, expect } from 'vitest';
import { getPlatformStatusLabel } from './PlatformsPage';

describe('getPlatformStatusLabel', () => {
  it('returns enabled when status is active', () => {
    expect(getPlatformStatusLabel('active')).toBe('enabled');
  });

  it('returns disabled when status is inactive', () => {
    expect(getPlatformStatusLabel('inactive')).toBe('disabled');
  });

  it('returns disabled when status is not-detected', () => {
    expect(getPlatformStatusLabel('not-detected')).toBe('disabled');
  });

  it('returns disabled for any unknown status', () => {
    expect(getPlatformStatusLabel('unknown')).toBe('disabled');
  });
});
