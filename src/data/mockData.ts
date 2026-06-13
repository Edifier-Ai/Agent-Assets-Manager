import type {
  AppSettings,
  Asset,
  Backup,
  Finding,
  ModelBinding,
  ModelProfile,
  Platform,
  ScanRun,
  ScanStep,
  ScanSummary,
} from '../types';

// Optional design-time placeholders kept only for non-runtime references.
export const defaultScanSteps: ScanStep[] = [];
export const modelProfiles: ModelProfile[] = [];

export const fallbackPlatforms: Platform[] = [
  {
    id: 'codex',
    name: 'Codex',
    kind: 'codex',
    cliPath: '~/.codex',
    version: 'dev fallback',
    configRoots: ['~/.codex'],
    writable: 'partial',
    detectedAt: '2026-06-13T00:00:00Z',
    status: 'active',
    assetCount: 2,
    warningCount: 1,
    icon: 'hexagon',
    safeActions: ['scan', 'preview'],
    previewRequiredActions: ['delete', 'move'],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    kind: 'claude',
    cliPath: '~/.claude',
    version: 'dev fallback',
    configRoots: ['~/.claude'],
    writable: 'readonly',
    detectedAt: '2026-06-13T00:00:00Z',
    status: 'active',
    assetCount: 1,
    warningCount: 0,
    icon: 'sun',
    safeActions: ['scan', 'preview'],
    previewRequiredActions: ['delete', 'move'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    kind: 'cursor',
    cliPath: '~/.cursor',
    version: 'dev fallback',
    configRoots: ['~/.cursor'],
    writable: 'partial',
    detectedAt: '2026-06-13T00:00:00Z',
    status: 'active',
    assetCount: 0,
    warningCount: 0,
    icon: 'cursor',
    safeActions: ['scan', 'preview'],
    previewRequiredActions: ['install'],
  },
];

export const fallbackAssets: Asset[] = [
  {
    id: 'skill-dev-frontend',
    type: 'Skill',
    name: 'frontend-testing-debugging',
    description: 'Development fallback asset for browser smoke testing.',
    author: 'OpenAI',
    version: '1.0.0',
    source: 'fallback',
    canonicalHash: 'dev-skill',
    directoryHash: 'dev-skill',
    riskLevel: 'low',
    status: ['installed', 'official'],
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    installations: [
      {
        id: 'install-skill-dev-frontend',
        assetId: 'skill-dev-frontend',
        platformId: 'codex',
        platformName: 'Codex',
        path: '~/.codex/skills/frontend-testing-debugging',
        scope: 'user',
        enabled: true,
        official: true,
        projectLocal: false,
        bindingType: 'skill',
        contentHash: 'dev-skill',
        status: 'ok',
      },
    ],
  },
  {
    id: 'command-dev-review',
    type: 'Command',
    name: 'review',
    description: 'Example command surfaced when Tauri is unavailable.',
    author: 'Local',
    version: '0.1.0',
    source: 'fallback',
    canonicalHash: 'dev-command',
    directoryHash: 'dev-command',
    riskLevel: 'medium',
    status: ['installed', 'needs-review', 'project-local'],
    createdAt: '2026-06-13T00:00:00Z',
    updatedAt: '2026-06-13T00:00:00Z',
    installations: [
      {
        id: 'install-command-dev-review',
        assetId: 'command-dev-review',
        platformId: 'codex',
        platformName: 'Codex',
        path: './.codex/commands/review.md',
        scope: 'project',
        enabled: true,
        official: false,
        projectLocal: true,
        bindingType: 'command',
        contentHash: 'dev-command',
        status: 'needs-review',
      },
    ],
  },
];

export const fallbackModelBindings: ModelBinding[] = [
  {
    id: 'model-dev-codex',
    platformId: 'codex',
    platformName: 'Codex',
    detectedProvider: 'OpenAI-compatible',
    detectedModelId: 'gpt-5-codex',
    detectedBaseUrl: 'env:OPENAI_BASE_URL',
    configPath: '~/.codex/config.toml',
    keyPresence: true,
    keyStorage: 'env',
    keySuffix: 'dev',
    validationStatus: 'warning',
    lastValidatedAt: '2026-06-13T00:00:00Z',
    warnings: ['Fallback data: launch the Tauri app for live validation.'],
  },
];

export const fallbackBackups: Backup[] = [];

export const fallbackFindings: Finding[] = [
  {
    id: 'finding-dev-project-local',
    assetId: 'command-dev-review',
    assetName: 'review',
    platformId: 'codex',
    platformName: 'Codex',
    issue: 'project-local',
    riskLevel: 'medium',
    detail: 'Project-local command requires preview before modification.',
  },
];

export const fallbackScanRuns: ScanRun[] = [
  {
    id: 'scan-dev-fallback',
    startedAt: '2026-06-13T00:00:00Z',
    completedAt: '2026-06-13T00:00:03Z',
    status: 'completed',
    platformsFound: fallbackPlatforms.length,
    assetsFound: fallbackAssets.length,
    duplicatesFound: 0,
    warningsFound: fallbackFindings.length,
    steps: [],
  },
];

export const fallbackSettings: AppSettings = {
  scanPaths: ['~/.codex', '~/.claude', '~/.opencode', '~/.hermes', '~/.openclaw'],
  includeProjectLocal: true,
  enableDeepScan: false,
  dbLocation: '~/.agent-assets-manager/app.db',
  trashLocation: '~/.agent-assets-manager/trash',
  theme: 'system',
  securityLevel: 'balanced',
};

export const fallbackScanSummary: ScanSummary = {
  platformsFound: fallbackPlatforms.length,
  assetsFound: fallbackAssets.length,
  duplicatesFound: 0,
  warningsFound: fallbackFindings.length,
};
