import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../components/Toast';
import type { AppSettings } from '../types';
import SettingsPage, { applyThemePreference, resolveSettingsFormState } from './SettingsPage';

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
      ignoredPlatformIds: ['claude-app'],
    };

    expect(resolveSettingsFormState(settings)).toEqual({
      theme: 'dark',
      scanPaths: ['~/.codex', '~/workspace/.claude'],
      includeProjectLocal: false,
      enableDeepScan: true,
      dbLocation: '/tmp/data.db',
      trashLocation: '/tmp/Trash',
      ignoredPlatformIds: ['claude-app'],
    });
  });

  it('falls back to defaults before settings load', () => {
    expect(resolveSettingsFormState()).toEqual({
      theme: 'system',
      scanPaths: [
        '~/.codex',
        '~/.claude',
        '~/Library/Application Support/Claude',
        '~/.opencode',
        '~/.hermes',
        '~/.openclaw',
      ],
      includeProjectLocal: true,
      enableDeepScan: false,
      dbLocation: '~/Library/Application Support/Agent Assets Manager/data.db',
      trashLocation: '~/Library/Application Support/Agent Assets Manager/Trash',
      ignoredPlatformIds: [],
    });
  });
});

describe('applyThemePreference', () => {
  it('uses system preference when theme follows the OS', () => {
    const classNames = new Set<string>();
    const root = {
      classList: {
        toggle(className: string, force?: boolean) {
          if (force) {
            classNames.add(className);
            return true;
          }
          classNames.delete(className);
          return false;
        },
      },
    };

    const appliedTheme = applyThemePreference('system', root, true);

    expect(appliedTheme).toBe('dark');
    expect(classNames.has('dark')).toBe(true);
  });

  it('removes dark mode when light theme is selected explicitly', () => {
    const classNames = new Set<string>(['dark']);
    const root = {
      classList: {
        toggle(className: string, force?: boolean) {
          if (force) {
            classNames.add(className);
            return true;
          }
          classNames.delete(className);
          return false;
        },
      },
    };

    const appliedTheme = applyThemePreference('light', root, true);

    expect(appliedTheme).toBe('light');
    expect(classNames.has('dark')).toBe(false);
  });
});

describe('SettingsPage layout', () => {
  it('keeps the reset and save actions pinned inside the settings viewport', () => {
    const html = renderToStaticMarkup(
      createElement(ToastProvider, { children: createElement(SettingsPage, {}) }),
    );

    expect(html).toContain('sticky');
    expect(html).toContain('bottom-0');
    expect(html).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
  });
});
