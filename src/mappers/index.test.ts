import { describe, expect, it } from 'vitest';
import { mapBatchSyncRequest, mapModelProfileDto, mapPlatformDto, mapSaveSettingsInput, mapScanRunDto, mapSettingsDto } from './index';

describe('platform DTO mapping', () => {
  it('maps snake_case platform fields into camelCase UI fields', () => {
    const mapped = mapPlatformDto({
      id: 'codex',
      name: 'Codex',
      kind: 'codex',
      cli_path: '/opt/homebrew/bin/codex',
      version: '1.0.0',
      config_roots: ['~/.codex'],
      writable: 'partial',
      detected_at: '2026-06-13T10:00:00Z',
      status: 'active',
      asset_count: 8,
      warning_count: 2,
      safe_actions: ['读取文件'],
      preview_required_actions: ['写入文件'],
    });

    expect(mapped.cliPath).toBe('/opt/homebrew/bin/codex');
    expect(mapped.configRoots).toEqual(['~/.codex']);
    expect(mapped.assetCount).toBe(8);
    expect(mapped.previewRequiredActions).toEqual(['写入文件']);
  });
});

describe('scan run DTO mapping', () => {
  it('maps nested scan steps to camelCase fields', () => {
    const mapped = mapScanRunDto({
      id: 'scan-1',
      started_at: '2026-06-13T10:00:00Z',
      completed_at: '2026-06-13T10:02:00Z',
      status: 'completed',
      platforms_found: 5,
      assets_found: 42,
      duplicates_found: 3,
      warnings_found: 4,
      steps: [
        {
          id: 'step-1',
          title: '检测平台',
          description: '检查 CLI',
          status: 'completed',
          detail: '发现 5 个平台',
        },
      ],
    });

    expect(mapped.platformsFound).toBe(5);
    expect(mapped.steps[0].status).toBe('completed');
    expect(mapped.steps[0].detail).toBe('发现 5 个平台');
  });
});

describe('settings DTO mapping', () => {
  it('maps persisted settings into app settings fields', () => {
    const mapped = mapSettingsDto({
      scan_paths: ['~/.codex'],
      include_project_local: true,
      enable_deep_scan: false,
      db_location: '/tmp/data.db',
      trash_location: '/tmp/Trash',
      theme: 'system',
      security_level: 'strict',
      ignored_platform_ids: ['claude-app'],
    });

    expect(mapped.scanPaths).toEqual(['~/.codex']);
    expect(mapped.includeProjectLocal).toBe(true);
    expect(mapped.enableDeepScan).toBe(false);
    expect(mapped.dbLocation).toBe('/tmp/data.db');
    expect(mapped.trashLocation).toBe('/tmp/Trash');
    expect(mapped.securityLevel).toBe('strict');
    expect(mapped.ignoredPlatformIds).toEqual(['claude-app']);
  });

  it('maps all editable settings into save request fields', () => {
    const mapped = mapSaveSettingsInput({
      theme: 'dark',
      scanPaths: ['/Users/test/.codex', '/Users/test/Projects'],
      includeProjectLocal: false,
      enableDeepScan: true,
      dbLocation: '/Users/test/Library/Application Support/Agent Assets Manager/data.db',
      trashLocation: '/Users/test/Library/Application Support/Agent Assets Manager/Trash',
      ignoredPlatformIds: ['claude-app', 'trae'],
    });

    expect(mapped.scan_paths).toEqual(['/Users/test/.codex', '/Users/test/Projects']);
    expect(mapped.include_project_local).toBe(false);
    expect(mapped.enable_deep_scan).toBe(true);
    expect(mapped.db_location).toBe('/Users/test/Library/Application Support/Agent Assets Manager/data.db');
    expect(mapped.trash_location).toBe('/Users/test/Library/Application Support/Agent Assets Manager/Trash');
    expect(mapped.theme).toBe('dark');
    expect(mapped.ignored_platform_ids).toEqual(['claude-app', 'trae']);
  });
});

describe('model profile DTO mapping', () => {
  it('maps snake_case model profile fields into camelCase UI fields', () => {
    const mapped = mapModelProfileDto({
      id: 'profile-1',
      name: 'OpenAI Default',
      provider: 'OpenAI',
      model_id: 'gpt-5.1-codex',
      base_url: 'https://api.openai.com/v1',
      key_storage: 'env',
      env_key_names: ['OPENAI_API_KEY'],
      notes: 'Default OpenAI coding profile',
      created_at: '2026-06-13T10:00:00Z',
      updated_at: '2026-06-13T10:00:00Z',
    });

    expect(mapped.modelId).toBe('gpt-5.1-codex');
    expect(mapped.baseUrl).toBe('https://api.openai.com/v1');
    expect(mapped.envKeyNames).toEqual(['OPENAI_API_KEY']);
  });
});

describe('batch sync DTO mapping', () => {
  it('keeps the selected source platform and item actions in the Tauri request', () => {
    const mapped = mapBatchSyncRequest({
      strategy: 'sync-from-source',
      sourcePlatformId: 'codex',
      items: [
        {
          assetId: 'asset-review',
          assetName: 'review',
          sourcePath: '~/.codex/skills/review',
          targetPlatform: 'cursor',
          targetPath: '~/.cursor/skills-cursor/review',
          action: 'install',
          sourceHash: 'hash-codex',
        },
      ],
    });

    expect(mapped.source_platform_id).toBe('codex');
    expect(mapped.items[0]).toMatchObject({
      asset_id: 'asset-review',
      target_platform: 'cursor',
      action: 'install',
    });
  });
});
