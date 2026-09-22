import type { RunStatus, RunType } from '@/lib/types';

/** Automated runs and the runs list refetch this often while a pipeline runs (the API polls GitLab every 20 s). */
export const PIPELINE_POLL_MS = 10_000;

export type PipelineTone = 'passed' | 'failed' | 'running' | 'pending' | 'skipped';

const PIPELINE: Record<string, { label: string; tone: PipelineTone }> = {
  created: { label: 'Created', tone: 'pending' },
  waiting_for_resource: { label: 'Waiting', tone: 'pending' },
  preparing: { label: 'Preparing', tone: 'pending' },
  pending: { label: 'Pending', tone: 'pending' },
  scheduled: { label: 'Scheduled', tone: 'pending' },
  manual: { label: 'Manual', tone: 'pending' },
  running: { label: 'Running', tone: 'running' },
  success: { label: 'Success', tone: 'passed' },
  failed: { label: 'Failed', tone: 'failed' },
  canceled: { label: 'Canceled', tone: 'skipped' },
  skipped: { label: 'Skipped', tone: 'skipped' },
};

export function pipelineStatusInfo(status: string | null | undefined): { label: string; tone: PipelineTone } {
  if (!status) return { label: 'Starting', tone: 'pending' };
  const known = PIPELINE[status];
  if (known) return known;
  const words = status.replace(/_/g, ' ');
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: 'pending' };
}

export function needsPipelinePolling(run: { type: RunType; status: RunStatus } | undefined): boolean {
  return run?.type === 'AUTOMATED' && run.status === 'IN_PROGRESS';
}

export function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
