import { ExternalLink, GitBranch } from 'lucide-react';
import type { TestRun } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PipelineStatusBadge } from './pipeline-status-badge';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** The note with any URL in it (e.g. the job link after "Pipeline finished without a test report") made a link. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Branch, pipeline status + link and the importer's note of an automated run (spec §10). Renders nothing for manual runs. */
export function AutomatedRunInfo({ run, compact = false, className }: { run: TestRun; compact?: boolean; className?: string }) {
  if (run.type !== 'AUTOMATED') return null;
  const showStatus = !!run.pipelineStatus || run.status === 'IN_PROGRESS';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', compact ? 'text-xs' : 'text-sm', className)}>
      {run.branch && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Branch </span>
          <span className="font-mono">{run.branch}</span>
        </span>
      )}
      {showStatus && <PipelineStatusBadge status={run.pipelineStatus} />}
      {run.pipelineWebUrl && (
        <a href={run.pipelineWebUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Pipeline{run.pipelineId ? ` #${run.pipelineId}` : ''}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
      {run.note && (
        <p className={cn('basis-full text-status-blocked-fg', compact && 'truncate')} title={run.note}>
          <NoteText text={run.note} />
        </p>
      )}
    </div>
  );
}
