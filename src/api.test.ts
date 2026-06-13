import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const isTauriMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

describe('api runtime stability', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
    delete (globalThis as { window?: unknown }).window;
  });

  it('uses development fallback data outside a Tauri runtime', async () => {
    const api = await import('./api');

    await expect(api.getPlatforms()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'codex',
          name: 'Codex',
        }),
      ]),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('keeps Tauri command failures user readable', async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({ success: false, error: 'database unavailable' });
    const api = await import('./api');

    await expect(api.getAssets()).rejects.toThrow('database unavailable');
  });
});
