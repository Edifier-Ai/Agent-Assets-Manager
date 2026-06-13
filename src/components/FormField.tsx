import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}

export default function FormField({ label, children, error, hint }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-gray-700 whitespace-nowrap">{label}</div>
      <div className={error ? '[&>input]:border-red-300 [&>input]:focus:border-red-400' : ''}>
        {children}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
