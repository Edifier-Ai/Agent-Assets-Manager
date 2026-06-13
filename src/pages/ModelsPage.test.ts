import { describe, it, expect } from 'vitest';
import { supportsApplyPreview, getApplySupportLabel } from './ModelsPage';
import type { Platform } from '../types';

function makePlatform(writable: Platform['writable']): Platform {
  return {
    id: '1',
    kind: 'Claude',
    name: 'Claude',
    status: 'active',
    cliPath: '/usr/bin/claude',
    version: '1.0.0',
    configRoots: [],
    writable,
    detectedAt: '2026-01-01',
    icon: 'claude',
    assetCount: 0,
    warningCount: 0,
    safeActions: [],
    previewRequiredActions: [],
  };
}

describe('supportsApplyPreview', () => {
  it('returns false when platform is undefined', () => {
    expect(supportsApplyPreview(undefined)).toBe(false);
  });

  it('returns false when platform is readonly', () => {
    expect(supportsApplyPreview(makePlatform('readonly'))).toBe(false);
  });

  it('returns true when platform is partial', () => {
    expect(supportsApplyPreview(makePlatform('partial'))).toBe(true);
  });

  it('returns true when platform is writable', () => {
    expect(supportsApplyPreview(makePlatform('writable'))).toBe(true);
  });
});

describe('getApplySupportLabel', () => {
  it('returns missing-platform label when platform is undefined', () => {
    expect(getApplySupportLabel(undefined)).toBe('平台信息缺失');
  });

  it('returns readonly label when platform is readonly', () => {
    expect(getApplySupportLabel(makePlatform('readonly'))).toBe('当前平台只读');
  });

  it('returns partial label when platform is partial', () => {
    expect(getApplySupportLabel(makePlatform('partial'))).toBe('支持受控写入预览');
  });

  it('returns writable label when platform is writable', () => {
    expect(getApplySupportLabel(makePlatform('writable'))).toBe('支持应用预览');
  });
});
