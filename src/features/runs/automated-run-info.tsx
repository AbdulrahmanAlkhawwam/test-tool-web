import { ExternalLink, GitBranch } from 'lucide-react';
import { safeExternalHref } from '@/lib/safe-external-href';
import type { TestRun } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PipelineStatusBadge } from './pipeline-status-badge';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/**
 * The note with any URL in it (e.g. the job link after "Pipeline finished without a test report")
 * made a link. The pattern above already requires an http(s) prefix, but `safeExternalHref` is
 * still run over each match so a URL that fails to parse renders as plain text, never a bad href.
 */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) => {
        if (i % 2 !== 1) return part;
        const href = safeExternalHref(part);
        return href ? (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

/** Branch, pipeline status + link and the importer's note of an automated run (spec §10). Renders nothing for manual runs. */
export function AutomatedRunInfo({ run, compact = false, className }: { run: TestRun; compact?: boolean; className?: string }) {
  if (run.type !== 'AUTOMATED') return null;
  const showStatus = !!run.pipelineStatus || run.status === 'IN_PROGRESS';
  const pipelineHref = safeExternalHref(run.pipelineWebUrl);
  const pipelineLabel = `Pipeline${run.pipelineId ? ` #${run.pipelineId}` : ''}`;
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
      {run.pipelineWebUrl &&
        (pipelineHref ? (
          <a href={pipelineHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            {pipelineLabel}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <span className="text-muted-foreground">{pipelineLabel}</span>
        ))}
      {run.note && (
        <p className={cn('basis-full text-status-blocked-fg', compact && 'truncate')} title={run.note}>
          <NoteText text={run.note} />
        </p>
      )}
    </div>
  );
}
