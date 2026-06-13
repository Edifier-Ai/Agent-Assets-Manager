import type {
  AppSettings,
  Asset,
  AssetStatus,
  AssetType,
  Backup,
  Finding,
  Installation,
  KeyStorage,
  ModelBinding,
  ModelProfile,
  OperationExecutionResult,
  OperationLog,
  OperationPreview,
  OperationRequest,
  Platform,
  RiskLevel,
  ScanRun,
  ScanStep,
  ScanStepStatus,
  ScanSummary,
  SaveSettingsInput,
  ValidationStatus,
  WritableStatus,
} from '../types';

export interface PlatformDto {
  id: string;
  name: string;
  kind: string;
  cli_path?: string | null;
  version?: string | null;
  config_roots?: string[];
  writable: string;
  detected_at: string;
  status: string;
  asset_count: number;
  warning_count: number;
  safe_actions?: string[];
  preview_required_actions?: string[];
}

export interface InstallationDto {
  id: string;
  asset_id: string;
  platform_id: string;
  platform_name: string;
  path: string;
  scope: string;
  enabled: boolean;
  official: boolean;
  project_local: boolean;
  binding_type: string;
  content_hash?: string | null;
  status: string;
}

export interface AssetDto {
  id: string;
  asset_type: string;
  name: string;
  description?: string | null;
  author?: string | null;
  version?: string | null;
  source: string;
  canonical_hash?: string | null;
  directory_hash?: string | null;
  risk_level: string;
  status: string | string[];
  created_at: string;
  updated_at: string;
  installations?: InstallationDto[];
}

export interface ModelBindingDto {
  id: string;
  platform_id: string;
  platform_name: string;
  detected_provider: string;
  detected_model_id: string;
  detected_base_url?: string | null;
  config_path: string;
  key_presence: boolean;
  key_storage: string;
  key_suffix?: string | null;
  validation_status: string;
  last_validated_at?: string | null;
  warnings?: string | string[] | null;
}

export interface ModelProfileDto {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  base_url: string;
  key_storage: string;
  env_key_names?: string[] | string | null;
  notes: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BackupDto {
  id: string;
  operation_id: string;
  operation_type: string;
  original_path: string;
  backup_path: string;
  hash: string;
  created_at: string;
}

export interface FindingDto {
  id: string;
  asset_id: string;
  asset_name: string;
  platform_id: string;
  platform_name: string;
  issue: string;
  risk_level: string;
  detail: string;
}

export interface ScanStepDto {
  id: string;
  title: string;
  description: string;
  status: string;
  progress?: number | null;
  detail?: string | null;
}

export interface ScanRunDto {
  id: string;
  started_at: string;
  completed_at?: string | null;
  status: string;
  platforms_found: number;
  assets_found: number;
  duplicates_found: number;
  warnings_found: number;
  steps?: ScanStepDto[];
}

export interface AppSettingsDto {
  scan_paths: string[];
  include_project_local: boolean;
  enable_deep_scan: boolean;
  db_location: string;
  trash_location: string;
  theme: string;
  security_level: string;
}

export interface SaveSettingsRequestDto {
  theme: string;
  scan_paths: string[];
  include_project_local: boolean;
  enable_deep_scan: boolean;
  db_location: string;
  trash_location: string;
}

export interface ScanSummaryDto {
  platforms_found: number;
  assets_found: number;
  duplicates_found: number;
  warnings_found: number;
}

export interface OperationRequestDto {
  operation_type: string;
  target_id?: string;
  target_name: string;
  target_type: string;
  target_path: string;
  source_path?: string;
  official: boolean;
  risk_level?: string;
  platform_id?: string;
}

export interface OperationPreviewDto {
  operation_type: string;
  target_id?: string | null;
  target_name: string;
  target_type: string;
  target_path: string;
  source_path?: string | null;
  supported: boolean;
  files_to_modify: string[];
  files_to_move: string[];
  backup_paths: string[];
  written_keys: string[];
  needs_restart: boolean;
  risks: string[];
}

export interface OperationExecutionResultDto {
  operation_id: string;
  operation_type: string;
  target_id?: string | null;
  target_path: string;
  outcome_path?: string | null;
  backup_id?: string | null;
  message: string;
}

const assetTypes: AssetType[] = [
  'Skill',
  'Agent',
  'Command',
  'MCP Server',
  'Tool',
  'Rule',
  'Memory',
  'Persona',
  'Provider Config',
  'Model Config',
  'CLI Runtime',
];

const assetStatuses: AssetStatus[] = [
  'installed',
  'enabled',
  'disabled',
  'official',
  'user-installed',
  'project-local',
  'duplicate',
  'conflict',
  'broken',
  'needs-review',
];

const writableStatuses: WritableStatus[] = ['writable', 'readonly', 'partial'];
const riskLevels: RiskLevel[] = ['low', 'medium', 'high'];
const keyStorages: KeyStorage[] = ['env', 'keychain', 'config', 'unknown'];
const validationStatuses: ValidationStatus[] = ['ok', 'warning', 'error', 'not-checked'];
const scanStepStatuses: ScanStepStatus[] = ['pending', 'running', 'completed', 'warning', 'error'];
const scanRunStatuses = ['running', 'completed', 'failed'] as const;
const platformStatuses = ['active', 'inactive', 'not-detected'] as const;

function parseList(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-splitting when stored text is not valid JSON.
    }
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesValue<T extends string>(values: readonly T[], candidate: string): candidate is T {
  return values.includes(candidate as T);
}

function normalizeAssetType(value: string): AssetType {
  return includesValue(assetTypes, value) ? value : 'Tool';
}

function normalizeAssetStatuses(value: string | string[]): AssetStatus[] {
  return parseList(value).filter((status): status is AssetStatus => includesValue(assetStatuses, status));
}

function normalizeWritableStatus(value: string): WritableStatus {
  return includesValue(writableStatuses, value) ? value : 'readonly';
}

function normalizeRiskLevel(value: string): RiskLevel {
  return includesValue(riskLevels, value) ? value : 'medium';
}

function normalizeKeyStorage(value: string): KeyStorage {
  return includesValue(keyStorages, value) ? value : 'unknown';
}

function normalizeValidationStatus(value: string): ValidationStatus {
  return includesValue(validationStatuses, value) ? value : 'not-checked';
}

function normalizeStepStatus(value: string): ScanStepStatus {
  return includesValue(scanStepStatuses, value) ? value : 'pending';
}

function normalizeRunStatus(value: string): ScanRun['status'] {
  return includesValue(scanRunStatuses, value) ? value : 'failed';
}

function normalizePlatformStatus(value: string): Platform['status'] {
  return includesValue(platformStatuses, value) ? value : 'inactive';
}

function defaultSafeActions(): string[] {
  return ['读取文件', '列出目录', '搜索内容', '查看配置'];
}

function defaultPreviewRequiredActions(): string[] {
  return ['写入文件', '编辑配置', '安装插件', '修改设置'];
}

export function mapPlatformDto(dto: PlatformDto): Platform {
  return {
    id: dto.id,
    name: dto.name,
    kind: dto.kind,
    cliPath: dto.cli_path ?? '',
    version: dto.version ?? '',
    configRoots: dto.config_roots ?? [],
    writable: normalizeWritableStatus(dto.writable),
    detectedAt: dto.detected_at,
    status: normalizePlatformStatus(dto.status),
    assetCount: dto.asset_count,
    warningCount: dto.warning_count,
    icon: dto.kind,
    safeActions: dto.safe_actions ?? defaultSafeActions(),
    previewRequiredActions: dto.preview_required_actions ?? defaultPreviewRequiredActions(),
  };
}

export function mapInstallationDto(dto: InstallationDto): Installation {
  return {
    id: dto.id,
    assetId: dto.asset_id,
    platformId: dto.platform_id,
    platformName: dto.platform_name,
    path: dto.path,
    scope: dto.scope,
    enabled: dto.enabled,
    official: dto.official,
    projectLocal: dto.project_local,
    bindingType: dto.binding_type,
    contentHash: dto.content_hash ?? '',
    status: dto.status,
  };
}

export function mapAssetDto(dto: AssetDto): Asset {
  return {
    id: dto.id,
    type: normalizeAssetType(dto.asset_type),
    name: dto.name,
    description: dto.description ?? '',
    author: dto.author ?? '',
    version: dto.version ?? '',
    source: dto.source,
    canonicalHash: dto.canonical_hash ?? '',
    directoryHash: dto.directory_hash ?? '',
    riskLevel: normalizeRiskLevel(dto.risk_level),
    status: normalizeAssetStatuses(dto.status),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    installations: (dto.installations ?? []).map(mapInstallationDto),
  };
}

export function mapModelBindingDto(dto: ModelBindingDto): ModelBinding {
  return {
    id: dto.id,
    platformId: dto.platform_id,
    platformName: dto.platform_name,
    detectedProvider: dto.detected_provider,
    detectedModelId: dto.detected_model_id,
    detectedBaseUrl: dto.detected_base_url ?? '',
    configPath: dto.config_path,
    keyPresence: dto.key_presence,
    keyStorage: normalizeKeyStorage(dto.key_storage),
    keySuffix: dto.key_suffix ?? undefined,
    validationStatus: normalizeValidationStatus(dto.validation_status),
    lastValidatedAt: dto.last_validated_at ?? '',
    warnings: parseList(dto.warnings),
  };
}

export function mapModelProfileDto(dto: ModelProfileDto): ModelProfile {
  return {
    id: dto.id,
    name: dto.name,
    provider: dto.provider,
    modelId: dto.model_id,
    baseUrl: dto.base_url,
    keyStorage: normalizeKeyStorage(dto.key_storage),
    envKeyNames: parseList(dto.env_key_names),
    notes: dto.notes,
    createdAt: dto.created_at ?? undefined,
    updatedAt: dto.updated_at ?? undefined,
  };
}

export function mapBackupDto(dto: BackupDto): Backup {
  return {
    id: dto.id,
    operationId: dto.operation_id,
    operationType: dto.operation_type,
    originalPath: dto.original_path,
    backupPath: dto.backup_path,
    hash: dto.hash,
    createdAt: dto.created_at,
  };
}

export interface OperationLogDto {
  id: string;
  operation_type: string;
  status: string;
  target_type: string;
  target_id: string | null;
  target_path: string | null;
  preview_json: string | null;
  result_json: string | null;
  backup_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export function mapOperationLogDto(dto: OperationLogDto): OperationLog {
  return {
    id: dto.id,
    operationType: dto.operation_type,
    status: dto.status,
    targetType: dto.target_type,
    targetId: dto.target_id,
    targetPath: dto.target_path,
    previewJson: dto.preview_json,
    resultJson: dto.result_json,
    backupId: dto.backup_id,
    createdAt: dto.created_at,
    completedAt: dto.completed_at,
  };
}

export function mapFindingDto(dto: FindingDto): Finding {
  return {
    id: dto.id,
    assetId: dto.asset_id,
    assetName: dto.asset_name,
    platformId: dto.platform_id,
    platformName: dto.platform_name,
    issue: dto.issue,
    riskLevel: normalizeRiskLevel(dto.risk_level),
    detail: dto.detail,
  };
}

export function mapScanStepDto(dto: ScanStepDto): ScanStep {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    status: normalizeStepStatus(dto.status),
    progress: dto.progress ?? undefined,
    detail: dto.detail ?? undefined,
  };
}

export function mapScanRunDto(dto: ScanRunDto): ScanRun {
  return {
    id: dto.id,
    startedAt: dto.started_at,
    completedAt: dto.completed_at ?? undefined,
    status: normalizeRunStatus(dto.status),
    platformsFound: dto.platforms_found,
    assetsFound: dto.assets_found,
    duplicatesFound: dto.duplicates_found,
    warningsFound: dto.warnings_found,
    steps: (dto.steps ?? []).map(mapScanStepDto),
  };
}

export function mapSettingsDto(dto: AppSettingsDto): AppSettings {
  return {
    scanPaths: dto.scan_paths,
    includeProjectLocal: dto.include_project_local,
    enableDeepScan: dto.enable_deep_scan,
    dbLocation: dto.db_location,
    trashLocation: dto.trash_location,
    theme: dto.theme,
    securityLevel: dto.security_level,
  };
}

export function mapScanSummaryDto(dto: ScanSummaryDto): ScanSummary {
  return {
    platformsFound: dto.platforms_found,
    assetsFound: dto.assets_found,
    duplicatesFound: dto.duplicates_found,
    warningsFound: dto.warnings_found,
  };
}

export function mapSaveSettingsInput(input: SaveSettingsInput): SaveSettingsRequestDto {
  return {
    theme: input.theme,
    scan_paths: input.scanPaths,
    include_project_local: input.includeProjectLocal,
    enable_deep_scan: input.enableDeepScan,
    db_location: input.dbLocation,
    trash_location: input.trashLocation,
  };
}

export function mapOperationRequest(input: OperationRequest): OperationRequestDto {
  return {
    operation_type: input.operationType,
    target_id: input.targetId,
    target_name: input.targetName,
    target_type: input.targetType,
    target_path: input.targetPath,
    source_path: input.sourcePath,
    official: input.official,
    risk_level: input.riskLevel,
    platform_id: input.platformId,
  };
}

export function mapOperationPreviewDto(dto: OperationPreviewDto): OperationPreview {
  return {
    operationType: dto.operation_type,
    targetId: dto.target_id ?? undefined,
    targetName: dto.target_name,
    targetType: dto.target_type,
    targetPath: dto.target_path,
    sourcePath: dto.source_path ?? undefined,
    supported: dto.supported,
    filesToModify: dto.files_to_modify ?? [],
    filesToMove: dto.files_to_move ?? [],
    backupPaths: dto.backup_paths ?? [],
    writtenKeys: dto.written_keys ?? [],
    needsRestart: dto.needs_restart,
    risks: dto.risks ?? [],
  };
}

export function mapOperationExecutionResultDto(
  dto: OperationExecutionResultDto,
): OperationExecutionResult {
  return {
    operationId: dto.operation_id,
    operationType: dto.operation_type,
    targetId: dto.target_id ?? undefined,
    targetPath: dto.target_path,
    outcomePath: dto.outcome_path ?? undefined,
    backupId: dto.backup_id ?? undefined,
    message: dto.message,
  };
}

// Batch Sync DTOs
export interface BatchSyncPreviewDto {
  strategy: string;
  total_items: number;
  items: SkillSyncItemPreviewDto[];
  has_conflicts: boolean;
  summary: string;
}

export interface SkillSyncItemPreviewDto {
  asset_id: string;
  asset_name: string;
  target_platform: string;
  target_platform_name: string;
  target_path: string;
  source_path: string;
  action: string;
  reason: string;
  supported: boolean;
  existing_hash?: string | null;
  source_hash: string;
}

export interface BatchSyncResultDto {
  operation_id: string;
  strategy: string;
  total_items: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  items: BatchSyncItemResultDto[];
  message: string;
}

export interface BatchSyncItemResultDto {
  asset_id: string;
  asset_name: string;
  target_platform: string;
  target_path: string;
  status: string;
  message: string;
  backup_id?: string | null;
}

export interface BatchSyncRequestDto {
  strategy: string;
  source_platform_id?: string | null;
  items: SkillSyncItemDto[];
}

export interface SkillSyncItemDto {
  asset_id: string;
  asset_name: string;
  source_path: string;
  target_platform: string;
  target_path: string;
  action: string;
  existing_hash?: string | null;
  source_hash: string;
}

export function mapBatchSyncPreviewDto(dto: BatchSyncPreviewDto): import('../types').BatchSyncPreview {
  return {
    strategy: dto.strategy,
    totalItems: dto.total_items,
    items: (dto.items ?? []).map(mapSkillSyncItemPreviewDto),
    hasConflicts: dto.has_conflicts,
    summary: dto.summary,
  };
}

export function mapSkillSyncItemPreviewDto(dto: SkillSyncItemPreviewDto): import('../types').BatchSyncItemPreview {
  return {
    assetId: dto.asset_id,
    assetName: dto.asset_name,
    targetPlatform: dto.target_platform,
    targetPlatformName: dto.target_platform_name,
    targetPath: dto.target_path,
    sourcePath: dto.source_path,
    action: dto.action,
    reason: dto.reason,
    supported: dto.supported,
    existingHash: dto.existing_hash ?? undefined,
    sourceHash: dto.source_hash,
  };
}

export function mapBatchSyncResultDto(dto: BatchSyncResultDto): import('../types').BatchSyncResult {
  return {
    operationId: dto.operation_id,
    strategy: dto.strategy,
    totalItems: dto.total_items,
    successCount: dto.success_count,
    skippedCount: dto.skipped_count,
    failedCount: dto.failed_count,
    items: (dto.items ?? []).map(mapBatchSyncItemResultDto),
    message: dto.message,
  };
}

export function mapBatchSyncItemResultDto(dto: BatchSyncItemResultDto): import('../types').BatchSyncItemResult {
  return {
    assetId: dto.asset_id,
    assetName: dto.asset_name,
    targetPlatform: dto.target_platform,
    targetPath: dto.target_path,
    status: dto.status,
    message: dto.message,
    backupId: dto.backup_id ?? undefined,
  };
}

export function mapBatchSyncRequest(input: import('../types').BatchSyncRequest): BatchSyncRequestDto {
  return {
    strategy: input.strategy,
    source_platform_id: input.sourcePlatformId ?? null,
    items: input.items.map(mapSkillSyncItem),
  };
}

export function mapSkillSyncItem(input: import('../types').SkillSyncItem): SkillSyncItemDto {
  return {
    asset_id: input.assetId,
    asset_name: input.assetName,
    source_path: input.sourcePath,
    target_platform: input.targetPlatform,
    target_path: input.targetPath,
    action: input.action,
    existing_hash: input.existingHash ?? null,
    source_hash: input.sourceHash,
  };
}
