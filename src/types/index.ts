export type NavPage = 'overview' | 'assets' | 'platforms' | 'models' | 'scan' | 'backups' | 'settings';

export type AssetType = 'Skill' | 'Agent' | 'Command' | 'MCP Server' | 'Tool' | 'Rule' | 'Memory' | 'Persona' | 'Provider Config' | 'Model Config' | 'CLI Runtime';

export type RiskLevel = 'low' | 'medium' | 'high';

export type AssetStatus = 'installed' | 'enabled' | 'disabled' | 'official' | 'user-installed' | 'project-local' | 'duplicate' | 'conflict' | 'broken' | 'needs-review';

export type WritableStatus = 'writable' | 'readonly' | 'partial';

export type ScanStepStatus = 'pending' | 'running' | 'completed' | 'warning' | 'error';

export type KeyStorage = 'env' | 'keychain' | 'config' | 'unknown';

export type ValidationStatus = 'ok' | 'warning' | 'error' | 'not-checked';

export interface Platform {
  id: string;
  name: string;
  kind: string;
  cliPath: string;
  version: string;
  configRoots: string[];
  writable: WritableStatus;
  detectedAt: string;
  status: 'active' | 'inactive' | 'not-detected';
  assetCount: number;
  warningCount: number;
  icon: string;
  safeActions: string[];
  previewRequiredActions: string[];
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  author: string;
  version: string;
  source: string;
  canonicalHash: string;
  directoryHash: string;
  riskLevel: RiskLevel;
  status: AssetStatus[];
  createdAt: string;
  updatedAt: string;
  installations: Installation[];
}

export interface Installation {
  id: string;
  assetId: string;
  platformId: string;
  platformName: string;
  path: string;
  scope: string;
  enabled: boolean;
  official: boolean;
  projectLocal: boolean;
  bindingType: string;
  contentHash: string;
  status: string;
}

export interface ModelBinding {
  id: string;
  platformId: string;
  platformName: string;
  detectedProvider: string;
  detectedModelId: string;
  detectedBaseUrl: string;
  configPath: string;
  keyPresence: boolean;
  keyStorage: KeyStorage;
  keySuffix?: string;
  validationStatus: ValidationStatus;
  lastValidatedAt: string;
  warnings: string[];
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string;
  keyStorage: string;
  envKeyNames: string[];
  notes: string;
}

export interface Backup {
  id: string;
  operationId: string;
  operationType: string;
  originalPath: string;
  backupPath: string;
  hash: string;
  createdAt: string;
}

export interface OperationPreview {
  operationType: string;
  targetName: string;
  targetType: string;
  modifiedFiles: string[];
  writtenKeys: string[];
  needsBackup: boolean;
  needsRestart: boolean;
  risks: string[];
  supported: boolean;
}

export interface ScanStep {
  id: string;
  title: string;
  description: string;
  status: ScanStepStatus;
  progress?: number;
  detail?: string;
}

export interface ScanRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  platformsFound: number;
  assetsFound: number;
  duplicatesFound: number;
  warningsFound: number;
  steps: ScanStep[];
}

export interface Finding {
  id: string;
  assetId: string;
  assetName: string;
  platformId: string;
  platformName: string;
  issue: string;
  riskLevel: RiskLevel;
  detail: string;
}
