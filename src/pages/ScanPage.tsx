import { useToast } from '../components/Toast';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, RotateCw, FolderSearch, CheckCircle2, Loader2, Clock, Ban
} from 'lucide-react';
import { defaultScanSteps, lastScanRun } from '../data/mockData';
import type { ScanStep, ScanRun } from '../types';

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanRun, setScanRun] = useState<ScanRun>(lastScanRun);
  const [steps, setSteps] = useState<ScanStep[]>(defaultScanSteps);
  const [showHistory, setShowHistory] = useState(false);
  const { showToast } = useToast();

  const startScan = () => {
    setIsScanning(true);
    setSteps(defaultScanSteps.map(s => ({ ...s, status: 'pending' as const })));

    const stepDelays = [500, 1500, 3000, 4500, 6000, 7500];
    stepDelays.forEach((delay, i) => {
      setTimeout(() => {
        setSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'running' as const } :
          idx < i ? { ...s, status: 'completed' as const, detail: getStepDetail(idx) } :
          s
        ));
      }, delay);
      setTimeout(() => {
        setSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'completed' as const, detail: getStepDetail(i) } : s
        ));
      }, delay + 1000);
    });

    setTimeout(() => {
      setIsScanning(false);
      setScanRun({
        ...lastScanRun,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      showToast('扫描完成：发现 5 个平台，128 个资产', 'success');
    }, 9000);
  };

  const getStepDetail = (i: number) => {
    const details = ['发现 5 个平台', '扫描 128 个资产', '解析 128 个资产', '发现 9 个重复项', '14 个需要检查', '索引已更新'];
    return details[i];
  };

  return (
    <div className="flex h-full overflow-y-auto">
      <div className="flex-1 p-5 space-y-5 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">扫描</h2>
            <p className="text-sm text-gray-500 mt-1">扫描本地 Agent 资产并更新索引</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              扫描历史
            </button>
            <button
              onClick={startScan}
              disabled={isScanning}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  扫描中...
                </>
              ) : (
                <>
                  <RotateCw className="w-4 h-4" />
                  重新扫描
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
              className="section-card overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-600 animate-pulse" />
                  <h3 className="font-semibold text-gray-900">正在扫描...</h3>
                </div>
              </div>
              <div className="p-5 space-y-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`scan-step ${step.status}`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {step.status === 'pending' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      )}
                      {step.status === 'running' && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      )}
                      {step.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs mt-0.5">{step.description}</div>
                      {step.detail && (
                        <div className="text-xs mt-1 text-green-600">{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isScanning && (
          <div className="section-card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">上次扫描结果</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.platformsFound}</div>
                <div className="text-xs text-gray-500 mt-1">发现平台</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.assetsFound}</div>
                <div className="text-xs text-gray-500 mt-1">扫描资产</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.duplicatesFound}</div>
                <div className="text-xs text-gray-500 mt-1">重复项</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">{scanRun.warningsFound}</div>
                <div className="text-xs text-gray-500 mt-1">需要检查</div>
              </div>
            </div>
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
                  'PATH: codex, claude, opencode, hermes, openclaw',
                  '/opt/homebrew/bin',
                  '/usr/local/bin',
                  '~/.local/bin',
                  '~/.codex, ~/.claude, ~/.opencode',
                  '~/.config/opencode, ~/.hermes, ~/.openclaw',
                ].map((path, i) => (
                  <code key={i} className="block text-xs font-mono text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">{path}</code>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200">
                <FolderSearch className="w-4 h-4" />
                选择深度扫描目录
              </button>
              <p className="text-xs text-gray-400 mt-2">深度扫描将遍历用户选择的目录，可能包含大量隐藏文件夹。</p>
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
                    <tr className="border-t border-gray-50">
                      <td className="px-5 py-3 text-gray-600">2024-06-12 14:32</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />完成
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">5</td>
                      <td className="px-5 py-3 text-gray-600">128</td>
                      <td className="px-5 py-3 text-gray-600">9</td>
                      <td className="px-5 py-3 text-gray-600">14</td>
                    </tr>
                    <tr className="border-t border-gray-50">
                      <td className="px-5 py-3 text-gray-600">2024-06-11 10:15</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />完成
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">5</td>
                      <td className="px-5 py-3 text-gray-600">126</td>
                      <td className="px-5 py-3 text-gray-600">8</td>
                      <td className="px-5 py-3 text-gray-600">12</td>
                    </tr>
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
