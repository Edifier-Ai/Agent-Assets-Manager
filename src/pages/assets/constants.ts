import type { AssetFilterId, AssetType } from '../../types';

export interface PlatformTarget {
  id: string;
  name: string;
  kind: string;
  configRoots?: string[];
  writable?: string;
  status?: string;
}

export const assetTypeOrder: AssetType[] = [
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

export const platformTargets: PlatformTarget[] = [
  { id: 'codex', name: 'Codex', kind: 'codex' },
  { id: 'claude', name: 'Claude', kind: 'claude' },
  { id: 'kimi', name: 'Kimi', kind: 'kimi' },
  { id: 'gemini', name: 'Gemini', kind: 'gemini' },
  { id: 'cursor', name: 'Cursor', kind: 'cursor' },
  { id: 'qwen', name: 'Qwen', kind: 'qwen' },
];

export const assetTypeSubdirByPlatform: Partial<Record<string, Partial<Record<AssetType, string>>>> = {
  cursor: {
    Skill: 'skills-cursor',
    Rule: 'rules',
    Command: 'commands',
  },
  gemini: {
    Rule: '',
    Skill: 'skills',
    Command: 'commands',
  },
};

export const defaultAssetTypeSubdirs: Partial<Record<AssetType, string>> = {
  Skill: 'skills',
  Agent: 'agents',
  Command: 'commands',
  'MCP Server': 'mcp',
  Rule: 'rules',
  Memory: 'memories',
  Persona: 'personas',
  'Model Config': 'models',
  'Provider Config': 'providers',
  'CLI Runtime': 'runtimes',
  Tool: 'tools',
};

export const configAssetTypes: AssetType[] = [
  'Memory',
  'Persona',
  'Provider Config',
  'Model Config',
  'CLI Runtime',
];

export const assetPrimaryFilters: Array<{ id: AssetFilterId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'Skill', label: '技能' },
  { id: 'Agent', label: 'Agent' },
  { id: 'Command', label: '命令' },
  { id: 'MCP Server', label: 'MCP' },
  { id: 'Rule', label: '规则' },
  { id: 'config', label: '配置' },
];

export const assetInsightFilters: Array<{ id: AssetFilterId; label: string }> = [
  { id: 'needs-review', label: '需要检查' },
  { id: 'duplicate', label: '重复项' },
  { id: 'conflict', label: '冲突' },
  { id: 'high', label: '风险' },
  { id: 'project-local', label: '项目本地' },
];

export const assetFilters: Array<{ id: AssetFilterId; label: string }> = [
  ...assetPrimaryFilters,
  ...assetInsightFilters,
];
