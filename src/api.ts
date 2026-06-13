import { invoke, isTauri as isTauriCoreRuntime } from '@tauri-apps/api/core';
import {
  fallbackAssets,
  fallbackBackups,
  fallbackFindings,
  fallbackModelBindings,
  fallbackPlatforms,
  fallbackScanRuns,
  fallbackScanSummary,
  fallbackSettings,
} from './data/mockData';
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
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function isTauriRuntime(): boolean {
  return isTauriCoreRuntime();
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
  if (!isTauriRuntime()) {
    return fallbackPlatforms;
  }
  const data = await invokeCmd<PlatformDto[]>('scan_platforms');
  return data.map(mapPlatformDto);
}

export async function scanAssets(input: ScanAssetsInput = {}): Promise<ScanSummary> {
  if (!isTauriRuntime()) {
    return fallbackScanSummary;
  }
  const scanRoots = input.scanRoots?.map((path) => path.trim()).filter(Boolean) ?? [];
  const data = await invokeCmd<ScanSummaryDto>('scan_assets', {
    request: {
      scan_roots: scanRoots,
    },
  });
  return mapScanSummaryDto(data);
}

export async function getPlatforms(): Promise<Platform[]> {
  if (!isTauriRuntime()) {
    return fallbackPlatforms;
  }
  const data = await invokeCmd<PlatformDto[]>('get_platforms');
  return data.map(mapPlatformDto);
}

export async function getAssets(): Promise<Asset[]> {
  if (!isTauriRuntime()) {
    return fallbackAssets;
  }
  const data = await invokeCmd<AssetDto[]>('get_assets');
  return data.map(mapAssetDto);
}

export async function getModelBindings(): Promise<ModelBinding[]> {
  if (!isTauriRuntime()) {
    return fallbackModelBindings;
  }
  const data = await invokeCmd<ModelBindingDto[]>('get_model_bindings');
  return data.map(mapModelBindingDto);
}

export async function getModelProfiles(): Promise<ModelProfile[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const data = await invokeCmd<ModelProfileDto[]>('get_model_profiles');
  return data.map(mapModelProfileDto);
}

export async function getBackups(): Promise<Backup[]> {
  if (!isTauriRuntime()) {
    return fallbackBackups;
  }
  const data = await invokeCmd<BackupDto[]>('get_backups');
  return data.map(mapBackupDto);
}

export async function getOperationLogs(): Promise<OperationLog[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const dtos = await invokeCmd<OperationLogDto[]>('get_operation_logs');
  return dtos.map(mapOperationLogDto);
}

export async function getFindings(): Promise<Finding[]> {
  if (!isTauriRuntime()) {
    return fallbackFindings;
  }
  const data = await invokeCmd<FindingDto[]>('get_findings');
  return data.map(mapFindingDto);
}

export async function getScanRuns(): Promise<ScanRun[]> {
  if (!isTauriRuntime()) {
    return fallbackScanRuns;
  }
  const data = await invokeCmd<ScanRunDto[]>('get_scan_runs');
  return data.map(mapScanRunDto);
}

export async function getAssetDetail(assetId: string): Promise<Asset> {
  if (!isTauriRuntime()) {
    const asset = fallbackAssets.find((item) => item.id === assetId);
    if (!asset) throw new Error(`Fallback asset not found: ${assetId}`);
    return asset;
  }
  const data = await invokeCmd<AssetDto>('get_asset_detail', { request: { asset_id: assetId } });
  return mapAssetDto(data);
}

export async function previewOperation(request: OperationRequest): Promise<OperationPreview> {
  if (!isTauriRuntime()) {
    return {
      operationType: request.operationType,
      targetId: request.targetId,
      targetName: request.targetName,
      targetType: request.targetType,
      targetPath: request.targetPath,
      sourcePath: request.sourcePath,
      filesToModify: [request.targetPath],
      filesToMove: [],
      backupPaths: [],
      writtenKeys: [],
      needsRestart: false,
      risks: ['Development fallback: no files will be modified outside Tauri.'],
      supported: false,
    };
  }
  const data = await invokeCmd<OperationPreviewDto>('preview_operation', {
    request: mapOperationRequest(request) as OperationRequestDto,
  });
  return mapOperationPreviewDto(data);
}

export async function executeOperation(
  request: OperationRequest,
): Promise<OperationExecutionResult> {
  if (!isTauriRuntime()) {
    throw new Error('File operations require the Tauri desktop app.');
  }
  const data = await invokeCmd<OperationExecutionResultDto>('execute_operation', {
    request: { preview: mapOperationRequest(request) },
  });
  return mapOperationExecutionResultDto(data);
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return fallbackSettings;
  }
  const data = await invokeCmd<AppSettingsDto>('get_settings');
  return mapSettingsDto(data);
}

export async function saveSettings(settings: SaveSettingsInput): Promise<string> {
  if (!isTauriRuntime()) {
    return `Development fallback: settings were not persisted (${settings.theme}).`;
  }
  return invokeCmd('save_settings', { request: mapSaveSettingsInput(settings) });
}
