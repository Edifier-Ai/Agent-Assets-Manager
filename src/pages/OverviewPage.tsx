import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Box, AlertTriangle, Copy, Brain, ChevronRight,
} from 'lucide-react';
import KpiCard from '../components/KpiCard';
import Badge from '../components/Badge';
import PlatformIcon from '../components/PlatformIcon';
import type { AssetFilterId, NavPage, Platform, Asset, Finding, ModelBinding } from '../types';

interface OverviewPageProps {
  platforms: Platform[];
  assets: Asset[];
  findings: Finding[];
  modelBindings: ModelBinding[];
  onSelectPlatform: (p: Platform) => void;
  onNavigate: (page: NavPage, options?: { assetFilter?: AssetFilterId }) => void;
}

export default function OverviewPage({ platforms, assets, findings, modelBindings, onSelectPlatform, onNavigate }: OverviewPageProps) {
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);

  const totalAssets = assets.length;
  const needsReview = findings.filter(f => f.riskLevel === 'high').length;
  const duplicates = assets.filter(a => a.status.includes('duplicate')).length;
  const modelWarnings = modelBindings.filter(m => m.warnings && m.warnings.length > 0).length;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="kpi-grid">
            <KpiCard
              icon={<Layers className="w-5 h-5 text-gray-900" />}
              label="平台数"
              value={platforms.length}
              color="bg-gray-100"
            />
            <KpiCard
              icon={<Box className="w-5 h-5 text-gray-900" />}
              label="资产总数"
              value={totalAssets}
              color="bg-gray-100"
            />
            <KpiCard
              icon={<AlertTriangle className="w-5 h-5 text-gray-900" />}
              label="需要检查"
              value={needsReview}
              color="bg-gray-100"
            />
            <KpiCard
              icon={<Copy className="w-5 h-5 text-gray-900" />}
              label="重复项"
              value={duplicates}
              color="bg-gray-100"
            />
            <KpiCard
              icon={<Brain className="w-5 h-5 text-gray-900" />}
              label="模型警告"
              value={modelWarnings}
              color="bg-gray-100"
            />
        </div>

        <div className="overview-card-grid">
          <div className="section-card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">已安装平台</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">平台</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">资产数</th>
                    <th className="px-5 py-3 font-medium">警告</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                      <tr
                        key={p.id}
                        className="table-row-hover cursor-pointer border-t border-gray-50"
                        onClick={() => onSelectPlatform(p)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <PlatformIcon kind={p.kind} platformName={p.name} className="w-5 h-5 shrink-0" />
                            <span className="font-medium text-gray-900 whitespace-nowrap">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge status={p.status === 'active' ? 'enabled' : 'disabled'} />
                        </td>
                        <td className="px-5 py-3 text-gray-600">{p.assetCount}</td>
                        <td className="px-5 py-3">
                          {p.warningCount > 0 ? (
                            <span className="text-amber-600 font-medium">{p.warningCount}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {platforms.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                暂无已安装平台。点击「重新扫描」开始检测。
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => onNavigate('platforms')}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                查看所有平台 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="section-card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">需要检查的资产</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">资产</th>
                    <th className="px-5 py-3 font-medium">平台</th>
                    <th className="px-5 py-3 font-medium">问题</th>
                    <th className="px-5 py-3 font-medium">风险</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr
                      key={f.id}
                      className={`table-row-hover cursor-pointer border-t border-gray-50 ${selectedFinding === f.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedFinding(f.id)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-100">
                            <Box className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{f.assetName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platformName={f.platformName} className="w-5 h-5 shrink-0" />
                          <span className="text-gray-600 whitespace-nowrap">{f.platformName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge status={f.issue.toLowerCase() === 'duplicate' ? 'duplicate' : f.issue.toLowerCase() === 'project-local' ? 'project-local' : f.issue.toLowerCase() === 'conflict' ? 'conflict' : 'needs-review'} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge risk={f.riskLevel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {findings.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                暂无需要检查的资产
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => onNavigate('assets', { assetFilter: 'needs-review' })}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                查看所有需要检查 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">模型配置</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">模型</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">使用平台</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">警告</th>
                </tr>
              </thead>
              <tbody>
                {modelBindings.map((mb) => (
                  <tr key={mb.id} className="table-row-hover border-t border-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm text-gray-900">{mb.detectedModelId}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{mb.detectedProvider}</td>
                    <td className="px-5 py-3 text-gray-600">{mb.platformName}</td>
                    <td className="px-5 py-3">
                      <Badge status={mb.validationStatus === 'ok' ? 'enabled' : 'needs-review'} />
                    </td>
                    <td className="px-5 py-3">
                      {mb.warnings && mb.warnings.length > 0 ? (
                        <span className="text-amber-600 font-medium">{mb.warnings.length}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modelBindings.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              暂无模型配置。扫描后将自动检测。
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-100">
            <button
              onClick={() => onNavigate('models')}
              className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              管理模型 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {selectedFinding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="section-card overflow-hidden"
            >
              <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">资产详情</span>
                </div>
              </div>
              <div className="px-5 py-4">
                {(() => {
                  const finding = findings.find(f => f.id === selectedFinding);
                  if (!finding) return null;
                  return (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-500">资产：</span><span className="font-medium text-gray-900">{finding.assetName}</span></p>
                      <p><span className="text-gray-500">平台：</span>{finding.platformName}</p>
                      <p><span className="text-gray-500">问题：</span><Badge status={finding.issue.toLowerCase() === 'duplicate' ? 'duplicate' : finding.issue.toLowerCase() === 'project-local' ? 'project-local' : 'conflict'} /></p>
                      <p><span className="text-gray-500">风险等级：</span><Badge risk={finding.riskLevel} /></p>
                      <p><span className="text-gray-500">详情：</span>{finding.detail}</p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
