import { PRIORITY_LABELS } from '@/lib/labels';
import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

const STYLE: Record<Priority, string> = {
  HIGH: 'border-status-failed/40 text-status-failed-fg',
  MEDIUM: 'border-status-blocked/50 text-status-blocked-fg',
  LOW: 'border-border text-muted-foreground',
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium', STYLE[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
