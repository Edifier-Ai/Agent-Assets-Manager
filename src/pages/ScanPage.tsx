import { useToast } from '../components/Toast';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, RotateCw, FolderSearch, CheckCircle2, Loader2, Clock, Ban, X
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import ProgressOverlay from '../components/ProgressOverlay';
import * as api from '../api';
import { formatDate } from '../utils';
import type { AppSettings, ScanRun } from '../types';

interface ScanPageProps {
  scanRuns: ScanRun[];
  settings?: AppSettings;
  onRefresh: () => Promise<void>;
}

export function isScanRunComplete(run: Pick<ScanRun, 'status'>): boolean {
  return run.status === 'completed';
}

type ScanCountSnapshot = Pick<ScanRun, 'assetsFound' | 'platformsFound' | 'duplicatesFound' | 'warningsFound'>;

function formatDelta(label: string, delta: number): string | null {
  if (delta === 0) return null;
  return `${label} ${delta > 0 ? '+' : ''}${delta}`;
}

export function buildScanChangeSummary(
  current: ScanCountSnapshot,
  previous?: ScanCountSnapshot,
): string[] {
  if (!previous) {
    return ['首次扫描建立本机资产基线'];
  }

  return [
    formatDelta('资产', current.assetsFound - previous.assetsFound),
    formatDelta('平台', current.platformsFound - previous.platformsFound),
    formatDelta('重复', current.duplicatesFound - previous.duplicatesFound),
    formatDelta('风险提示', current.warningsFound - previous.warningsFound),
  ].filter((item): item is string => Boolean(item));
}

function renderStatus(status: ScanRun['status']) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1.5 text-green-600">
        <CheckCircle2 className="w-3.5 h-3.5" />完成
      </span>
    );
  }

  if (status === 'running') {
    return (
      <span className="flex items-center gap-1.5 text-blue-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />进行中
      </span>
    );
  }

  return <span className="text-red-600">失败</span>;
}

export default function ScanPage({ scanRuns, settings, onRefresh }: ScanPageProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanRun, setScanRun] = useState<ScanRun | null>(scanRuns[0] || null);
  const [showHistory, setShowHistory] = useState(false);
  const [deepScanRoots, setDeepScanRoots] = useState<string[]>([]);
  const cancelledRef = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    setScanRun(scanRuns[0] || null);
  }, [scanRuns]);

  const cancelScan = () => {
    cancelledRef.current = true;
    setIsScanning(false);
    showToast('扫描已中断', 'info');
  };

  const startScan = async () => {
    cancelledRef.current = false;
    setIsScanning(true);
    try {
      await api.scanAssets({ scanRoots: deepScanRoots });
      if (cancelledRef.current) return;
      const latestRuns = await api.getScanRuns();
      const latestRun = latestRuns[0] || null;
      setScanRun(latestRun);
      await onRefresh();

      if (latestRun) {
        showToast(
          `扫描完成：发现 ${latestRun.platformsFound} 个平台，${latestRun.assetsFound} 个资产`,
          'success',
        );
      } else {
        showToast('扫描完成，但未读取到最新扫描记录', 'success');
      }
    } catch (error) {
      console.error('Scan failed:', error);
      showToast(error instanceof Error ? error.message : '扫描失败，请稍后重试。', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const chooseDeepScanDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: '选择深度扫描目录',
      });
      const selectedPaths = Array.isArray(selected) ? selected : selected ? [selected] : [];

      if (selectedPaths.length === 0) {
        return;
      }

      setDeepScanRoots((roots) => Array.from(new Set([...roots, ...selectedPaths])));
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法打开目录选择器', 'error');
    }
  };

  const savedScanPaths = settings?.scanPaths ?? [
    '~/.codex',
    '~/.claude',
    '~/Library/Application Support/Claude',
    '~/.opencode',
    '~/.hermes',
    '~/.openclaw',
    '~/.kimi-code',
    '~/.gemini',
    '~/.qwen',
    '~/.cursor',
    '~/.trae',
    '~/.trae-cn',
  ];
  const scanChangeSummary = scanRun ? buildScanChangeSummary(scanRun, scanRuns[1]) : [];

  return (
    <div className="flex h-full overflow-y-auto">
      <div className="flex-1 p-5 space-y-5 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 whitespace-nowrap">扫描</h2>
            <p className="text-sm text-gray-500 mt-1">扫描本地 Agent 资产并更新索引</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              <span className="whitespace-nowrap">扫描历史</span>
            </button>
            <button
              onClick={startScan}
              disabled={isScanning}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="whitespace-nowrap">扫描中...</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4" />
                  <span className="whitespace-nowrap">重新扫描</span>
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ProgressOverlay
                label="正在扫描本地资产..."
                indeterminate
                onCancel={cancelScan}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!isScanning && scanRun && (
          <div className="section-card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">上次扫描结果</h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <div className="grid grid-cols-4 gap-4 min-w-[560px]">
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.platformsFound}</div>
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">发现平台</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.assetsFound}</div>
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">扫描资产</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.duplicatesFound}</div>
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">重复项</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.warningsFound}</div>
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">需要检查</div>
              </div>
              </div>
            </div>
            {scanChangeSummary.length > 0 && (
              <div className="px-5 pb-5">
                <div className="flex flex-wrap gap-2 rounded-xl bg-blue-50 px-3 py-2">
                  {scanChangeSummary.map((item) => (
                    <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!!scanRun.steps.length && (
              <div className="px-5 pb-5 space-y-2">
                {scanRun.steps.map((step) => (
                  <div key={step.id} className={`scan-step ${step.status}`}>
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm whitespace-nowrap">{step.title}</div>
                      <div className="text-xs mt-0.5 text-gray-500">{step.description}</div>
                      {step.detail && <div className="text-xs mt-1 text-green-600">{step.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isScanning && !scanRun && (
          <div className="section-card p-8 text-center text-gray-400">
            <ScanLine className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暂无扫描记录。点击「重新扫描」开始检测。</p>
          </div>
        )}

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">扫描范围</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">默认路径</div>
              <div className="space-y-1.5">
                {[
                  'PATH: codex, claude, opencode, hermes, openclaw, kimi, gemini, qwen, trae',
                  'App Support: Claude App, Trae',
                  '/opt/homebrew/bin',
                  '/usr/local/bin',
                  '~/.local/bin',
                  ...savedScanPaths,
                ].map((path, i) => (
                  <code key={i} className="block text-xs font-mono text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">{path}</code>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={chooseDeepScanDirectory}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <FolderSearch className="w-4 h-4" />
                <span className="whitespace-nowrap">选择深度扫描目录</span>
              </button>
              <p className="text-xs text-gray-400 mt-2">
                {deepScanRoots.length > 0
                  ? '重新扫描会优先使用下方已选择目录。'
                  : settings?.enableDeepScan
                    ? '未单独选择目录时，将使用设置页保存的深度扫描路径。'
                    : '深度扫描将遍历用户选择的目录，可能包含大量隐藏文件夹。'}
              </p>
              {deepScanRoots.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {deepScanRoots.map((root) => (
                    <div key={root} className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-gray-600 bg-blue-50 px-3 py-2 rounded-lg break-all">{root}</code>
                      <button
                        onClick={() => setDeepScanRoots((roots) => roots.filter((item) => item !== root))}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="移除目录"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Ban className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900">跳过路径与警告</h3>
          </div>
          <div className="p-5">
            <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-600">
              <p>扫描过程中默认不会广泛遍历隐藏目录（如 <code className="font-mono text-xs">.git</code>, <code className="font-mono text-xs">node_modules</code>）。</p>
              <p className="mt-2">Secret 文件（如 <code className="font-mono text-xs">.env</code>, private keys）会被标记为敏感但不读取内容。</p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="section-card overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">扫描历史</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="px-5 py-3 font-medium">时间</th>
                      <th className="px-5 py-3 font-medium">状态</th>
                      <th className="px-5 py-3 font-medium">平台</th>
                      <th className="px-5 py-3 font-medium">资产</th>
                      <th className="px-5 py-3 font-medium">重复</th>
                      <th className="px-5 py-3 font-medium">警告</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanRuns.map((run) => (
                      <tr key={run.id} className="border-t border-gray-50">
                        <td className="px-5 py-3 text-gray-600">
                          {formatDate(run.completedAt || run.startedAt)}
                        </td>
                        <td className="px-5 py-3">{renderStatus(run.status)}</td>
                        <td className="px-5 py-3 text-gray-600">{run.platformsFound}</td>
                        <td className="px-5 py-3 text-gray-600">{run.assetsFound}</td>
                        <td className="px-5 py-3 text-gray-600">{run.duplicatesFound}</td>
                        <td className="px-5 py-3 text-gray-600">{run.warningsFound}</td>
                      </tr>
                    ))}
                    {!scanRuns.length && (
                      <tr className="border-t border-gray-50">
                        <td colSpan={6} className="px-5 py-6 text-center text-gray-400">
                          暂无持久化扫描历史
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
