import type { RunSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

const SEGMENTS = [
  { key: 'passed', label: 'passed', className: 'bg-status-passed' },
  { key: 'failed', label: 'failed', className: 'bg-status-failed' },
  { key: 'blocked', label: 'blocked', className: 'bg-status-blocked' },
  { key: 'skipped', label: 'skipped', className: 'bg-status-skipped' },
  { key: 'notExecuted', label: 'not executed', className: 'bg-status-pending' },
] as const;

export function describeSummary(summary: RunSummary): string {
  if (!summary.total) return 'No results yet';
  return SEGMENTS.filter((s) => summary[s.key] > 0)
    .map((s) => `${summary[s.key]} ${s.label}`)
    .join(', ');
}

export function StatusBar({ summary, className }: { summary: RunSummary; className?: string }) {
  const label = describeSummary(summary);
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex h-2 w-full overflow-hidden rounded-full bg-status-pending', className)}
    >
      {summary.total > 0 &&
        SEGMENTS.filter((s) => summary[s.key] > 0).map((s) => (
          <div
            key={s.key}
            data-segment={s.key}
            className={s.className}
            style={{ width: `${(summary[s.key] / summary.total) * 100}%` }}
          />
        ))}
    </div>
  );
}
