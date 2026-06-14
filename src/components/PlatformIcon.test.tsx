import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PlatformIcon from './PlatformIcon';

describe('PlatformIcon', () => {
  it('renders every platform icon inside the shared black brand frame', () => {
    const html = renderToStaticMarkup(
      <PlatformIcon kind="claude" platformName="Claude Code" className="h-6 w-6" alt="Claude" />,
    );

    expect(html).toContain('platform-icon-frame');
    expect(html).toContain('bg-[#101114]');
    expect(html).toContain('h-6 w-6');
    expect(html).toContain('alt="Claude"');
  });
});
