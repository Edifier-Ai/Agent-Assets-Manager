import { AlertTriangle, ArrowRight, Brain, CheckCircle2, ShieldAlert } from 'lucide-react';
import Badge from '../components/Badge';
import type { AssetFilterId, Finding, ModelBinding, NavPage, RiskLevel } from '../types';

interface DiagnosticsPageProps {
  findings: Finding[];
  modelBindings: ModelBinding[];
  onNavigate: (page: NavPage, options?: { assetFilter?: AssetFilterId }) => void;
}

interface DiagnosticsSummary {
  total: number;
  highRisk: number;
  mediumRisk: number;
  modelWarnings: number;
}

const riskWeight: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortDiagnostics(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => riskWeight[a.riskLevel] - riskWeight[b.riskLevel]);
}

export function buildDiagnosticsSummary(
  findings: Finding[],
  modelBindings: ModelBinding[],
): DiagnosticsSummary {
  const modelWarnings = modelBindings.filter((binding) => binding.warnings.length > 0 || binding.validationStatus !== 'ok').length;
  return {
    total: findings.length + modelWarnings,
    highRisk: findings.filter((finding) => finding.riskLevel === 'high').length,
    mediumRisk: findings.filter((finding) => finding.riskLevel === 'medium').length + modelWarnings,
    modelWarnings,
  };
}

function issueFilter(issue: string): AssetFilterId {
  const normalized = issue.toLowerCase();
  if (normalized === 'duplicate') return 'duplicate';
  if (normalized === 'conflict') return 'conflict';
  if (normalized === 'project-local') return 'project-local';
  return 'needs-review';
}

function riskLabel(risk: RiskLevel): string {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

export default function DiagnosticsPage({ findings, modelBindings, onNavigate }: DiagnosticsPageProps) {
  const sortedFindings = sortDiagnostics(findings);
  const summary = buildDiagnosticsSummary(findings, modelBindings);
  const modelWarnings = modelBindings.filter((binding) => binding.warnings.length > 0 || binding.validationStatus !== 'ok');

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 whitespace-nowrap">问题中心</h2>
            <p className="mt-1 text-sm text-gray-500">集中处理扫描风险、配置漂移和模型 Key 警告</p>
          </div>
          <button
            onClick={() => onNavigate('scan')}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            重新扫描
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="mt-1 text-xs text-gray-500 whitespace-nowrap">待处理项</div>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-2xl font-bold text-red-700">{summary.highRisk}</div>
            <div className="mt-1 text-xs text-red-600 whitespace-nowrap">高风险</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-2xl font-bold text-amber-700">{summary.mediumRisk}</div>
            <div className="mt-1 text-xs text-amber-600 whitespace-nowrap">中风险</div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-2xl font-bold text-blue-700">{summary.modelWarnings}</div>
            <div className="mt-1 text-xs text-blue-600 whitespace-nowrap">模型警告</div>
          </div>
        </div>

        <div className="section-card">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900">扫描诊断</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {sortedFindings.map((finding) => (
              <button
                key={finding.id}
                onClick={() => onNavigate('assets', { assetFilter: issueFilter(finding.issue) })}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{finding.assetName}</span>
                    <Badge status={finding.issue.toLowerCase() === 'conflict' ? 'conflict' : finding.issue.toLowerCase() === 'duplicate' ? 'duplicate' : 'needs-review'} />
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {riskLabel(finding.riskLevel)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{finding.detail}</p>
                  <p className="mt-1 text-xs text-gray-400">{finding.platformName}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
              </button>
            ))}
            {sortedFindings.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                暂无扫描风险
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Brain className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-gray-900">模型配置警告</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {modelWarnings.map((binding) => (
              <button
                key={binding.id}
                onClick={() => onNavigate('models')}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-gray-900 whitespace-nowrap">{binding.platformName}</span>
                    <span className="text-xs text-gray-500">{binding.detectedModelId}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {binding.warnings.length > 0 ? binding.warnings.join('、') : '模型配置需要重新验证'}
                  </p>
                  <code className="mt-1 block truncate text-xs text-gray-400">{binding.configPath}</code>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
              </button>
            ))}
            {modelWarnings.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                暂无模型配置警告
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
