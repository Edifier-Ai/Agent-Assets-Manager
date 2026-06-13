import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ProgressOverlayProps {
  label: string;
  current?: number;
  total?: number;
  onCancel?: () => void;
  indeterminate?: boolean;
}

export default function ProgressOverlay({ label, current, total, onCancel, indeterminate }: ProgressOverlayProps) {
  const percentage = total && current != null ? Math.round((current / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">{label}</span>
            {total && current != null && (
              <span className="text-xs text-gray-400">{current}/{total}</span>
            )}
          </div>
          {!indeterminate && total ? (
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ) : (
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            </div>
          )}
        </div>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          取消
        </button>
      )}
    </motion.div>
  );
}
