import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  if (!dateStr) {
    return '未知时间';
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '未知时间';
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskApiKey(suffix: string): string {
  return `存在，末尾 ...${suffix}`;
}

export function getRiskLabel(level: string): string {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return map[level] || level;
}

export function getRiskColorClass(level: string): string {
  const map: Record<string, string> = {
    low: 'bg-green-50 text-green-700 border-green-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-red-50 text-red-700 border-red-200',
  };
  return map[level] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    enabled: 'bg-green-50 text-green-700 border-green-200',
    disabled: 'bg-gray-100 text-gray-500 border-gray-200',
    readonly: 'bg-gray-100 text-gray-500 border-gray-200',
    writable: 'bg-blue-50 text-blue-700 border-blue-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    official: 'bg-purple-50 text-purple-700 border-purple-200',
    'user-installed': 'bg-blue-50 text-blue-700 border-blue-200',
    'project-local': 'bg-orange-50 text-orange-700 border-orange-200',
    duplicate: 'bg-red-50 text-red-700 border-red-200',
    conflict: 'bg-red-50 text-red-700 border-red-200',
    'needs-review': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[status] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    enabled: '已启用',
    disabled: '已禁用',
    readonly: '只读',
    writable: '可写',
    partial: '部分可写',
    official: '官方',
    'user-installed': '用户安装',
    'project-local': '项目本地',
    duplicate: '重复',
    conflict: '冲突',
    'needs-review': '需要检查',
  };
  return map[status] || status;
}

export function getAssetTypeLabel(type: string): string {
  const map: Record<string, string> = {
    'Skill': 'Skill',
    'Agent': 'Agent',
    'Command': 'Command',
    'MCP Server': 'MCP Server',
    'Tool': 'Tool',
    'Rule': 'Rule',
    'Memory': 'Memory',
    'Persona': 'Persona',
    'Provider Config': 'Provider Config',
    'Model Config': 'Model Config',
    'CLI Runtime': 'CLI Runtime',
  };
  return map[type] || type;
}

export function deriveSource(asset: { source: string; installations: Array<{ platformName: string; scope: string; projectLocal?: boolean }> }): string {
  if (asset.source && asset.source !== 'unknown' && asset.source !== '') {
    return asset.source;
  }
  const inst = asset.installations[0];
  if (!inst) return '本机';
  const platform = inst.platformName || '本机';
  if (inst.projectLocal || inst.scope === 'project') return `${platform} 项目级`;
  if (inst.scope === 'global' || inst.scope === 'user') return `${platform} 全局`;
  return platform;
}

export function getFileName(path: string): string {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || path;
}

export function getKeyStorageLabel(storage: string): string {
  const map: Record<string, string> = {
    env: '环境变量',
    keychain: 'Keychain',
    config: '配置文件',
    unknown: '未知',
  };
  return map[storage] || storage;
}

export function getValidationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ok: '正常',
    warning: '警告',
    error: '错误',
    'not-checked': '未检查',
  };
  return map[status] || status;
}

export function getValidationStatusColor(status: string): string {
  const map: Record<string, string> = {
    ok: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    'not-checked': 'text-gray-400',
  };
  return map[status] || 'text-gray-500';
}
