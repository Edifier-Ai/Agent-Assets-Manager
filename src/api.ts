import { invoke } from '@tauri-apps/api/core';
import {
  mapModelProfileDto,
  mapAssetDto,
  mapBackupDto,
  mapFindingDto,
  mapModelBindingDto,
  mapOperationExecutionResultDto,
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
  OperationPreview,
  OperationRequest,
  Platform,
  ScanRun,
  ScanSummary,
  SaveSettingsInput,
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
  const data = await invokeCmd<PlatformDto[]>('scan_platforms');
  return data.map(mapPlatformDto);
}

export async function scanAssets(): Promise<ScanSummary> {
  const data = await invokeCmd<ScanSummaryDto>('scan_assets');
  return mapScanSummaryDto(data);
}

export async function getPlatforms(): Promise<Platform[]> {
  const data = await invokeCmd<PlatformDto[]>('get_platforms');
  return data.map(mapPlatformDto);
}

export async function getAssets(): Promise<Asset[]> {
  const data = await invokeCmd<AssetDto[]>('get_assets');
  return data.map(mapAssetDto);
}

export async function getModelBindings(): Promise<ModelBinding[]> {
  const data = await invokeCmd<ModelBindingDto[]>('get_model_bindings');
  return data.map(mapModelBindingDto);
}

export async function getModelProfiles(): Promise<ModelProfile[]> {
  const data = await invokeCmd<ModelProfileDto[]>('get_model_profiles');
  return data.map(mapModelProfileDto);
}

export async function getBackups(): Promise<Backup[]> {
  const data = await invokeCmd<BackupDto[]>('get_backups');
  return data.map(mapBackupDto);
}

export async function getFindings(): Promise<Finding[]> {
  const data = await invokeCmd<FindingDto[]>('get_findings');
  return data.map(mapFindingDto);
}

export async function getScanRuns(): Promise<ScanRun[]> {
  const data = await invokeCmd<ScanRunDto[]>('get_scan_runs');
  return data.map(mapScanRunDto);
}

export async function getAssetDetail(assetId: string): Promise<Asset> {
  const data = await invokeCmd<AssetDto>('get_asset_detail', { request: { asset_id: assetId } });
  return mapAssetDto(data);
}

export async function previewOperation(request: OperationRequest): Promise<OperationPreview> {
  const data = await invokeCmd<OperationPreviewDto>('preview_operation', {
    request: mapOperationRequest(request) as OperationRequestDto,
  });
  return mapOperationPreviewDto(data);
}

export async function executeOperation(
  request: OperationRequest,
): Promise<OperationExecutionResult> {
  const data = await invokeCmd<OperationExecutionResultDto>('execute_operation', {
    request: { preview: mapOperationRequest(request) },
  });
  return mapOperationExecutionResultDto(data);
}

export async function getSettings(): Promise<AppSettings> {
  const data = await invokeCmd<AppSettingsDto>('get_settings');
  return mapSettingsDto(data);
}

export async function saveSettings(settings: SaveSettingsInput): Promise<string> {
  return invokeCmd('save_settings', { request: mapSaveSettingsInput(settings) });
}
