import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pipelineStatusInfo, type PipelineTone } from './pipeline';

// Same token pattern as StatusBadge (tinted background, dark foreground) for AA contrast.
const TONE: Record<PipelineTone, string> = {
  passed: 'bg-status-passed/15 text-status-passed-fg',
  failed: 'bg-status-failed/15 text-status-failed-fg',
  running: 'bg-brand-blue/15 text-primary',
  pending: 'bg-status-pending/60 text-status-pending-fg',
  skipped: 'bg-status-skipped/15 text-status-skipped-fg',
};

export function PipelineStatusBadge({ status }: { status: string | null | undefined }) {
  const info = pipelineStatusInfo(status);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONE[info.tone])}
      title="GitLab pipeline status"
    >
      {info.tone === 'running' ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      <span className="sr-only">Pipeline </span>
      {info.label}
    </span>
  );
}
