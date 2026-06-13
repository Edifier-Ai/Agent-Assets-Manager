export type NavPage = 'overview' | 'assets' | 'platforms' | 'models' | 'diagnostics' | 'scan' | 'backups' | 'operations' | 'settings';

export type AssetType = 'Skill' | 'Agent' | 'Command' | 'MCP Server' | 'Tool' | 'Rule' | 'Memory' | 'Persona' | 'Provider Config' | 'Model Config' | 'CLI Runtime';

export type AssetFilterId = 'all' | AssetType | 'needs-review' | 'duplicate' | 'conflict' | 'high' | 'project-local';

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
  keyStorage: KeyStorage;
  envKeyNames: string[];
  notes: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface OperationLog {
  id: string;
  operationType: string;
  status: string;
  targetType: string;
  targetId: string | null;
  targetPath: string | null;
  previewJson: string | null;
  resultJson: string | null;
  backupId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface OperationRequest {
  operationType: string;
  targetId?: string;
  targetName: string;
  targetType: string;
  targetPath: string;
  sourcePath?: string;
  official: boolean;
  riskLevel?: RiskLevel;
  platformId?: string;
}

export interface OperationPreview {
  operationType: string;
  targetId?: string;
  targetName: string;
  targetType: string;
  targetPath: string;
  sourcePath?: string;
  filesToModify: string[];
  filesToMove: string[];
  backupPaths: string[];
  writtenKeys: string[];
  needsRestart: boolean;
  risks: string[];
  supported: boolean;
}

export interface OperationExecutionResult {
  operationId: string;
  operationType: string;
  targetId?: string;
  targetPath: string;
  outcomePath?: string;
  backupId?: string;
  message: string;
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

export interface ScanSummary {
  platformsFound: number;
  assetsFound: number;
  duplicatesFound: number;
  warningsFound: number;
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
export interface AppSettings {
  scanPaths: string[];
  includeProjectLocal: boolean;
  enableDeepScan: boolean;
  dbLocation: string;
  trashLocation: string;
  theme: string;
  securityLevel: string;
}

export interface SaveSettingsInput {
  theme: string;
  scanPaths: string[];
  includeProjectLocal: boolean;
  enableDeepScan: boolean;
  dbLocation: string;
  trashLocation: string;
}

export interface ScanAssetsInput {
  scanRoots?: string[];
}
