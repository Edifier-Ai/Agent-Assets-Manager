import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, CheckCircle2, Loader2, ArrowRight, ArrowLeft,
  Layers, Box, AlertTriangle, Copy
} from 'lucide-react';
import * as api from '../api';
import PlatformIcon from './PlatformIcon';
import type { ScanRun } from '../types';

interface FirstRunWizardProps {
  onComplete: () => void;
}

export default function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [step, setStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [scanRun, setScanRun] = useState<ScanRun | null>(null);
  const [error, setError] = useState('');

  const steps = [
    { title: '欢迎', description: 'Agent Assets Manager 将帮助你发现和管理本地 AI Agent 资产。' },
    { title: '权限说明', description: '应用需要读取 Agent 工具配置目录来发现平台和资产，包括 ~/.codex, ~/Library/Application Support/Claude, ~/.opencode, ~/.hermes, ~/.openclaw, ~/.kimi-code, ~/.gemini, ~/.qwen, ~/.cursor, ~/.trae 等。Secret 文件不会被读取内容。' },
    { title: '首次扫描', description: '开始扫描你的 Mac 以发现已安装的 Agent 平台和相关资产。' },
  ];

  const startScan = async () => {
    setScanning(true);
    setCompleted(false);
    setError('');
    setScanRun(null);

    try {
      await api.scanAssets();
      const runs = await api.getScanRuns();
      setScanRun(runs[0] || null);
      setCompleted(true);
    } catch (scanError) {
      console.error('Initial scan failed:', scanError);
      setError(scanError instanceof Error ? scanError.message : '扫描失败，请稍后重试。');
    } finally {
      setScanning(false);
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      await startScan();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center">
      <div className="w-full max-w-lg mx-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <PlatformIcon kind="app" className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Agent Assets Manager</h1>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-gray-900 w-8' : 'bg-gray-200 w-4'}`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-gray-50 rounded-2xl p-8 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{steps[step].title}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{steps[step].description}</p>
            </div>

            {step === 2 && scanning && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-blue-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900">正在执行真实扫描</div>
                    <div className="text-xs mt-1 text-gray-500">
                      后端会将本次 scan run 与 scan steps 写入 SQLite，完成后这里会显示真实结果。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-4 mb-6 text-sm text-red-700">
                {error}
              </div>
            )}

            {completed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 rounded-2xl border border-green-100 p-6 mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">扫描完成</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-xs">平台</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{scanRun?.platformsFound ?? 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Box className="w-3.5 h-3.5" />
                      <span className="text-xs">资产</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{scanRun?.assetsFound ?? 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-xs">重复</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{scanRun?.duplicatesFound ?? 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs">需要检查</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{scanRun?.warningsFound ?? 0}</div>
                  </div>
                </div>
                {!!scanRun?.steps.length && (
                  <div className="mt-4 space-y-2">
                    {scanRun.steps.map((currentStep) => (
                      <div key={currentStep.id} className={`scan-step ${currentStep.status}`}>
                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                          {currentStep.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{currentStep.title}</div>
                          {currentStep.detail && <div className="text-xs mt-0.5 text-green-600">{currentStep.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0 || scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            上一步
          </button>

          {completed ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
            >
              进入概览
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={scanning}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {step === 2 ? (
                <>
                  <ScanLine className="w-4 h-4" />
                  开始扫描
                </>
              ) : (
                <>
                  下一步
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
