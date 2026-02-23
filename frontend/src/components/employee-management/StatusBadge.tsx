import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'active' | 'inactive';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-2 border-amber-300',
      label: 'Pending',
    },
    active: {
      icon: CheckCircle,
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-2 border-green-300',
      label: 'Active',
    },
    inactive: {
      icon: XCircle,
      bg: 'bg-gray-100/50',
      text: 'text-gray-700',
      border: 'border-2 border-gray-300',
      label: 'Inactive',
    },
  };

  const { icon: Icon, bg, text, border, label } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap',
        bg,
        text,
        border,
        status === 'pending' && 'animate-pulse-slow',
        className
      )}
      aria-live="polite"
      role="status"
    >
      <Icon className={cn('w-3.5 h-3.5', text)} />
      {label}
    </span>
  );
}

