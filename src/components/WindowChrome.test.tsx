import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WindowChrome from './WindowChrome';

describe('WindowChrome', () => {
  it('does not render a decorative right-side spacer after removing status icons', () => {
    const html = renderToStaticMarkup(<WindowChrome />);

    expect(html).toContain('Agent Assets Manager');
    expect(html).not.toContain('aria-hidden="true"');
  });
});
