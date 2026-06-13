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

import App from './App';

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
