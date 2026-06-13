import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: string;
  suffix?: string;
}

export default function KpiCard({ icon, label, value, color, suffix }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
        <div className="shrink-0">
          <div className="text-xs text-gray-500 font-medium whitespace-nowrap">{label}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
            {suffix && <span className="text-xs text-gray-400 whitespace-nowrap">{suffix}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
