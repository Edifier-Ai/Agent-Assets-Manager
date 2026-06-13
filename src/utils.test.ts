import { describe, expect, it } from 'vitest';
import { formatDate } from './utils';

describe('formatDate', () => {
  it('returns a fallback label for invalid date strings', () => {
    expect(formatDate('Invalid Date')).toBe('未知时间');
    expect(formatDate('')).toBe('未知时间');
  });
});
