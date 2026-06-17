import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const isTauriMock = vi.fn();

const UNSUPPORTED_RUNTIME_MESSAGE = 'Real business data is available only in the Tauri desktop app.';

const sampleOperationRequest = {
  operationType: 'disable',
  targetId: 'asset-1',
  targetName: 'review',
  targetType: 'Command',
  targetPath: '/tmp/review.md',
  official: false,
} as const;

const sampleBatchSyncRequest = {
  strategy: 'mirror',
  items: [
    {
      assetId: 'skill-1',
      assetName: 'review-helper',
      sourcePath: '/tmp/source/review-helper',
      targetPlatform: 'cursor',
      targetPath: '/tmp/target/review-helper',
      action: 'install',
      sourceHash: 'hash-1',
    },
  ],
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

describe('api runtime contract', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
    delete (globalThis as { window?: unknown }).window;
  });

  it('rejects browser-mode read APIs outside Tauri', async () => {
    const api = await import('./api');

    await expect(api.scanPlatforms()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getPlatforms()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getAssets()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getModelBindings()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getModelProfiles()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getBackups()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getOperationLogs()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getFindings()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getScanRuns()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getAssetDetail('asset-1')).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.getSettings()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.scanAssets()).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('rejects browser-mode preview and write APIs outside Tauri', async () => {
    const api = await import('./api');

    await expect(api.previewOperation(sampleOperationRequest)).rejects.toThrow(
      UNSUPPORTED_RUNTIME_MESSAGE,
    );
    await expect(api.executeOperation(sampleOperationRequest)).rejects.toThrow(
      UNSUPPORTED_RUNTIME_MESSAGE,
    );
    await expect(
      api.saveSettings({
        theme: 'dark',
        scanPaths: ['~/.codex'],
        includeProjectLocal: false,
        enableDeepScan: true,
        dbLocation: '/tmp/dev-data.db',
        trashLocation: '/tmp/dev-trash',
        ignoredPlatformIds: [],
      }),
    ).rejects.toThrow(UNSUPPORTED_RUNTIME_MESSAGE);
    await expect(api.previewSkillSyncPlan(['skill-1'], 'mirror')).rejects.toThrow(
      UNSUPPORTED_RUNTIME_MESSAGE,
    );
    await expect(api.executeSkillSyncPlan(sampleBatchSyncRequest)).rejects.toThrow(
      UNSUPPORTED_RUNTIME_MESSAGE,
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('keeps Tauri command failures user readable', async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({ success: false, error: { code: 'DATABASE_ERROR', message: 'database unavailable' } });
    const api = await import('./api');

    await expect(api.getAssets()).rejects.toThrow('database unavailable');
  });
});
