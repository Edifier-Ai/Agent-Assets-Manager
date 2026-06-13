import { invoke, isTauri as isTauriCoreRuntime } from '@tauri-apps/api/core';
import {
  mapModelProfileDto,
  mapAssetDto,
  mapBackupDto,
  mapFindingDto,
  mapModelBindingDto,
  mapOperationExecutionResultDto,
  mapOperationLogDto,
  mapOperationPreviewDto,
  mapOperationRequest,
  mapPlatformDto,
  mapSaveSettingsInput,
  mapScanRunDto,
  mapScanSummaryDto,
  mapSettingsDto,
  mapBatchSyncPreviewDto,
  mapBatchSyncResultDto,
  mapBatchSyncRequest,
  type AppSettingsDto,
  type AssetDto,
  type BackupDto,
  type FindingDto,
  type ModelBindingDto,
  type ModelProfileDto,
  type OperationExecutionResultDto,
  type OperationLogDto,
  type OperationPreviewDto,
  type OperationRequestDto,
  type PlatformDto,
  type ScanRunDto,
  type ScanSummaryDto,
  type BatchSyncPreviewDto,
  type BatchSyncResultDto,
} from './mappers';
import type {
  AppSettings,
  Asset,
  Backup,
  Finding,
  ModelBinding,
  ModelProfile,
  OperationExecutionResult,
  OperationLog,
  OperationPreview,
  OperationRequest,
  Platform,
  ScanAssetsInput,
  ScanRun,
  ScanSummary,
  SaveSettingsInput,
  BatchSyncPreview,
  BatchSyncResult,
  BatchSyncRequest,
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const UNSUPPORTED_RUNTIME_MESSAGE = 'Real business data is available only in the Tauri desktop app.';

export function isTauriRuntime(): boolean {
  return isTauriCoreRuntime();
}

function assertTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error(UNSUPPORTED_RUNTIME_MESSAGE);
  }
}

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const resp = await invoke<ApiResponse<T>>(cmd, args);
  if (!resp.success) {
    throw new Error(resp.error || 'Unknown error');
  }
  if (resp.data === undefined) {
    throw new Error('No data returned');
  }
  return resp.data;
}

export async function scanPlatforms(): Promise<Platform[]> {
  assertTauriRuntime();
  const data = await invokeCmd<PlatformDto[]>('scan_platforms');
  return data.map(mapPlatformDto);
}

export async function scanAssets(input: ScanAssetsInput = {}): Promise<ScanSummary> {
  assertTauriRuntime();
  const scanRoots = input.scanRoots?.map((path) => path.trim()).filter(Boolean) ?? [];
  const data = await invokeCmd<ScanSummaryDto>('scan_assets', {
    request: {
      scan_roots: scanRoots,
    },
  });
  return mapScanSummaryDto(data);
}

export async function getPlatforms(): Promise<Platform[]> {
  assertTauriRuntime();
  const data = await invokeCmd<PlatformDto[]>('get_platforms');
  return data.map(mapPlatformDto);
}

export async function getAssets(): Promise<Asset[]> {
  assertTauriRuntime();
  const data = await invokeCmd<AssetDto[]>('get_assets');
  return data.map(mapAssetDto);
}

export async function getModelBindings(): Promise<ModelBinding[]> {
  assertTauriRuntime();
  const data = await invokeCmd<ModelBindingDto[]>('get_model_bindings');
  return data.map(mapModelBindingDto);
}

export async function getModelProfiles(): Promise<ModelProfile[]> {
  assertTauriRuntime();
  const data = await invokeCmd<ModelProfileDto[]>('get_model_profiles');
  return data.map(mapModelProfileDto);
}

export async function getBackups(): Promise<Backup[]> {
  assertTauriRuntime();
  const data = await invokeCmd<BackupDto[]>('get_backups');
  return data.map(mapBackupDto);
}

export async function getOperationLogs(): Promise<OperationLog[]> {
  assertTauriRuntime();
  const dtos = await invokeCmd<OperationLogDto[]>('get_operation_logs');
  return dtos.map(mapOperationLogDto);
}

export async function getFindings(): Promise<Finding[]> {
  assertTauriRuntime();
  const data = await invokeCmd<FindingDto[]>('get_findings');
  return data.map(mapFindingDto);
}

export async function getScanRuns(): Promise<ScanRun[]> {
  assertTauriRuntime();
  const data = await invokeCmd<ScanRunDto[]>('get_scan_runs');
  return data.map(mapScanRunDto);
}

export async function getAssetDetail(assetId: string): Promise<Asset> {
  assertTauriRuntime();
  const data = await invokeCmd<AssetDto>('get_asset_detail', { request: { asset_id: assetId } });
  return mapAssetDto(data);
}

export async function previewOperation(request: OperationRequest): Promise<OperationPreview> {
  assertTauriRuntime();
  const data = await invokeCmd<OperationPreviewDto>('preview_operation', {
    request: mapOperationRequest(request) as OperationRequestDto,
  });
  return mapOperationPreviewDto(data);
}

export async function executeOperation(
  request: OperationRequest,
): Promise<OperationExecutionResult> {
  assertTauriRuntime();
  const data = await invokeCmd<OperationExecutionResultDto>('execute_operation', {
    request: { preview: mapOperationRequest(request) },
  });
  return mapOperationExecutionResultDto(data);
}

export async function getSettings(): Promise<AppSettings> {
  assertTauriRuntime();
  const data = await invokeCmd<AppSettingsDto>('get_settings');
  return mapSettingsDto(data);
}

export async function saveSettings(settings: SaveSettingsInput): Promise<string> {
  assertTauriRuntime();
  return invokeCmd('save_settings', { request: mapSaveSettingsInput(settings) });
}

export async function previewSkillSyncPlan(
  assetIds: string[],
  strategy: string,
  sourcePlatformId?: string,
): Promise<BatchSyncPreview> {
  assertTauriRuntime();
  const data = await invokeCmd<BatchSyncPreviewDto>('preview_skill_sync_plan', {
    request: { asset_ids: assetIds, strategy, source_platform_id: sourcePlatformId ?? null },
  });
  return mapBatchSyncPreviewDto(data);
}

export async function executeSkillSyncPlan(
  request: BatchSyncRequest,
): Promise<BatchSyncResult> {
  assertTauriRuntime();
  const data = await invokeCmd<BatchSyncResultDto>('execute_skill_sync_plan', {
    request: mapBatchSyncRequest(request),
  });
  return mapBatchSyncResultDto(data);
}
