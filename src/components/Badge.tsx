import { cn, getStatusBadgeClass, getStatusLabel, getRiskLabel, getRiskColorClass } from '../utils';

interface BadgeProps {
  status?: string;
  risk?: string;
  className?: string;
}

export default function Badge({ status, risk, className }: BadgeProps) {
  if (status) {
    return (
      <span className={cn('badge border', getStatusBadgeClass(status), className)}>
        {getStatusLabel(status)}
      </span>
    );
  }
  if (risk) {
    return (
      <span className={cn('badge border', getRiskColorClass(risk), className)}>
        {getRiskLabel(risk)}
      </span>
    );
  }
  return null;
}
