import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isTauriRuntimeMock, showToastMock } = vi.hoisted(() => ({
  isTauriRuntimeMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    isTauriRuntime: isTauriRuntimeMock,
  };
});

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('./components/WindowChrome', () => ({
  default: () => <div>WindowChrome</div>,
}));

vi.mock('./components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('./components/StatusBar', () => ({
  default: () => <div>StatusBar</div>,
}));

vi.mock('./components/DetailPanel', () => ({
  default: () => <div>DetailPanel</div>,
}));

vi.mock('./components/ConfirmDialog', () => ({
  default: () => <div>ConfirmDialog</div>,
}));

vi.mock('./components/FirstRunWizard', () => ({
  default: () => <div>FirstRunWizard</div>,
}));

vi.mock('./components/Toast', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

vi.mock('./pages/OverviewPage', () => ({
  default: () => <div>OverviewPage</div>,
}));

vi.mock('./pages/assets', () => ({
  default: () => <div>AssetsPage</div>,
}));

vi.mock('./pages/PlatformsPage', () => ({
  default: () => <div>PlatformsPage</div>,
}));

vi.mock('./pages/ModelsPage', () => ({
  default: () => <div>ModelsPage</div>,
}));

vi.mock('./pages/DiagnosticsPage', () => ({
  default: () => <div>DiagnosticsPage</div>,
}));

vi.mock('./pages/ScanPage', () => ({
  default: () => <div>ScanPage</div>,
}));

vi.mock('./pages/BackupsPage', () => ({
  default: () => <div>BackupsPage</div>,
}));

vi.mock('./pages/OperationsPage', () => ({
  default: () => <div>OperationsPage</div>,
}));

vi.mock('./pages/SettingsPage', () => ({
  applyThemePreference: vi.fn(),
  default: () => <div>SettingsPage</div>,
}));

import App, { filterIgnoredPlatformData } from './App';
import type { AppSettings, Asset, Finding, ModelBinding, Platform } from './types';

function makePlatform(id: string): Platform {
  return {
    id,
    name: id,
    kind: id,
    cliPath: '',
    version: '',
    configRoots: [],
    writable: 'partial',
    detectedAt: '2026-06-14T00:00:00Z',
    status: 'active',
    assetCount: 1,
    warningCount: 0,
    icon: id,
    safeActions: [],
    previewRequiredActions: [],
  };
}

function makeAsset(id: string, platformIds: string[]): Asset {
  return {
    id,
    type: 'Skill',
    name: id,
    description: '',
    author: '',
    version: '',
    source: 'local',
    canonicalHash: '',
    directoryHash: '',
    riskLevel: 'low',
    status: ['installed'],
    createdAt: '2026-06-14T00:00:00Z',
    updatedAt: '2026-06-14T00:00:00Z',
    installations: platformIds.map((platformId) => ({
      id: `${id}-${platformId}`,
      assetId: id,
      platformId,
      platformName: platformId,
      path: `/tmp/${platformId}/${id}`,
      scope: 'user',
      enabled: true,
      official: false,
      projectLocal: false,
      bindingType: 'copy',
      contentHash: '',
      status: 'installed',
    })),
  };
}

function makeSettings(ignoredPlatformIds: string[]): AppSettings {
  return {
    scanPaths: [],
    includeProjectLocal: true,
    enableDeepScan: false,
    dbLocation: '/tmp/data.db',
    trashLocation: '/tmp/Trash',
    theme: 'system',
    securityLevel: 'strict',
    ignoredPlatformIds,
  };
}

describe('App runtime boundary', () => {
  beforeEach(() => {
    isTauriRuntimeMock.mockReset();
    showToastMock.mockReset();
  });

  it('在非 Tauri 环境渲染阻断态提示', () => {
    isTauriRuntimeMock.mockReturnValue(false);

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('当前运行在浏览器壳中');
    expect(html).toContain('仅 Tauri 桌面应用支持真实数据');
    expect(html).toContain('npm run tauri dev');
  });

  it('在 Tauri 环境不渲染阻断态提示', () => {
    isTauriRuntimeMock.mockReturnValue(true);

    const html = renderToStaticMarkup(<App />);

    expect(html).not.toContain('当前运行在浏览器壳中');
    expect(html).toContain('WindowChrome');
    expect(html).toContain('OverviewPage');
  });
});

describe('filterIgnoredPlatformData', () => {
  it('hides ignored platforms and their platform-bound records globally', () => {
    const filtered = filterIgnoredPlatformData({
      platforms: [makePlatform('codex'), makePlatform('claude-app')],
      assets: [
        makeAsset('shared-skill', ['codex', 'claude-app']),
        makeAsset('app-only-skill', ['claude-app']),
      ],
      modelBindings: [
        { id: 'mb-codex', platformId: 'codex', platformName: 'Codex', detectedProvider: 'OpenAI', detectedModelId: 'gpt', detectedBaseUrl: '', configPath: '', keyPresence: false, keyStorage: 'unknown', validationStatus: 'ok', lastValidatedAt: '', warnings: [] },
        { id: 'mb-app', platformId: 'claude-app', platformName: 'Claude App', detectedProvider: 'Anthropic', detectedModelId: 'sonnet', detectedBaseUrl: '', configPath: '', keyPresence: false, keyStorage: 'unknown', validationStatus: 'ok', lastValidatedAt: '', warnings: [] },
      ] as ModelBinding[],
      findings: [
        { id: 'f-codex', assetId: 'shared-skill', assetName: 'shared-skill', platformId: 'codex', platformName: 'Codex', issue: 'ok', riskLevel: 'low', detail: '' },
        { id: 'f-app', assetId: 'app-only-skill', assetName: 'app-only-skill', platformId: 'claude-app', platformName: 'Claude App', issue: 'ignored', riskLevel: 'medium', detail: '' },
      ] as Finding[],
      settings: makeSettings(['claude-app']),
    });

    expect(filtered.platforms.map((platform) => platform.id)).toEqual(['codex']);
    expect(filtered.assets.map((asset) => asset.id)).toEqual(['shared-skill']);
    expect(filtered.assets[0].installations.map((installation) => installation.platformId)).toEqual(['codex']);
    expect(filtered.modelBindings.map((binding) => binding.id)).toEqual(['mb-codex']);
    expect(filtered.findings.map((finding) => finding.id)).toEqual(['f-codex']);
  });
});
