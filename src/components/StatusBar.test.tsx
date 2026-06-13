import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  it('shows an empty scan timestamp as not scanned', () => {
    const html = renderToStaticMarkup(
      <StatusBar lastScanTime="" onRescan={() => undefined} />,
    );

    expect(html).toContain('上次扫描：未扫描');
    expect(html).not.toContain('Invalid Date');
  });
});
