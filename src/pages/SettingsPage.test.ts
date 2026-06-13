import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../types';
import { resolveSettingsFormState } from './SettingsPage';

describe('resolveSettingsFormState', () => {
  it('uses persisted settings when available', () => {
    const settings: AppSettings = {
      scanPaths: ['~/.codex', '~/workspace/.claude'],
      includeProjectLocal: false,
      enableDeepScan: true,
      dbLocation: '/tmp/data.db',
      trashLocation: '/tmp/Trash',
      theme: 'dark',
      securityLevel: 'balanced',
    };

    expect(resolveSettingsFormState(settings)).toEqual({
      theme: 'dark',
      scanPaths: ['~/.codex', '~/workspace/.claude'],
      includeProjectLocal: false,
      enableDeepScan: true,
      dbLocation: '/tmp/data.db',
      trashLocation: '/tmp/Trash',
    });
  });

  it('falls back to defaults before settings load', () => {
    expect(resolveSettingsFormState()).toEqual({
      theme: 'system',
      scanPaths: ['~/.codex', '~/.claude', '~/.opencode', '~/.hermes', '~/.openclaw'],
      includeProjectLocal: true,
      enableDeepScan: false,
      dbLocation: '~/Library/Application Support/Agent Assets Manager/data.db',
      trashLocation: '~/Library/Application Support/Agent Assets Manager/Trash',
    });
  });
});
