import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Sidebar from './Sidebar';
import type { ScanRun } from '../types';

const completedRun: ScanRun = {
  id: 'scan-1',
  startedAt: '2026-06-13T12:00:00Z',
  completedAt: '2026-06-13T12:01:00Z',
  status: 'completed',
  platformsFound: 5,
  assetsFound: 42,
  duplicatesFound: 2,
  warningsFound: 3,
  steps: [],
};

describe('Sidebar', () => {
  it('renders scan status from the latest scan run statistics', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        active="overview"
        onNavigate={() => undefined}
        latestScanRun={completedRun}
      />,
    );

    expect(html).toContain('本地扫描完成');
    expect(html).toContain('42 资产已索引');
    expect(html).not.toContain('128 资产已索引');
  });
});
