import { describe, it, expect } from 'vitest';
import {
  getOperationTypeLabel,
  isOperationComplete,
} from './OperationsPage';
import type { OperationLog } from '../types';

describe('getOperationTypeLabel', () => {
  it('maps delete to 删除', () => {
    expect(getOperationTypeLabel('delete')).toBe('删除');
  });
  it('maps restore to 还原', () => {
    expect(getOperationTypeLabel('restore')).toBe('还原');
  });
  it('maps install-asset to 安装', () => {
    expect(getOperationTypeLabel('install-asset')).toBe('安装');
  });
  it('maps apply-model-profile to 应用模型配置', () => {
    expect(getOperationTypeLabel('apply-model-profile')).toBe('应用模型配置');
  });
  it('returns raw value for unknown type', () => {
    expect(getOperationTypeLabel('unknown-op')).toBe('unknown-op');
  });
});

describe('isOperationComplete', () => {
  it('returns true for completed status', () => {
    const log = { status: 'completed' } as OperationLog;
    expect(isOperationComplete(log)).toBe(true);
  });
  it('returns true for failed status', () => {
    const log = { status: 'failed' } as OperationLog;
    expect(isOperationComplete(log)).toBe(true);
  });
  it('returns false for running status', () => {
    const log = { status: 'running' } as OperationLog;
    expect(isOperationComplete(log)).toBe(false);
  });
});
