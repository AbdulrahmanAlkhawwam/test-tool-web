import { STATUS_LABELS } from '@/lib/labels';
import type { ResultStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const BADGE: Record<ResultStatus, string> = {
  PASSED: 'bg-status-passed/15 text-status-passed-fg',
  FAILED: 'bg-status-failed/15 text-status-failed-fg',
  BLOCKED: 'bg-status-blocked/20 text-status-blocked-fg',
  SKIPPED: 'bg-status-skipped/15 text-status-skipped-fg',
  NOT_EXECUTED: 'bg-status-pending/60 text-status-pending-fg',
};

const DOT: Record<ResultStatus, string> = {
  PASSED: 'bg-status-passed',
  FAILED: 'bg-status-failed',
  BLOCKED: 'bg-status-blocked',
  SKIPPED: 'bg-status-skipped',
  NOT_EXECUTED: 'bg-status-pending-fg/50',
};

export function StatusBadge({ status, className }: { status: ResultStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', BADGE[status], className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}
