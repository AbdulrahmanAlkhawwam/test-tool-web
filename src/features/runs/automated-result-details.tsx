import { ExternalLink } from 'lucide-react';
import { reportUrlFromArtifacts } from '@/features/gitlab/paths';
import type { RunResult } from '@/lib/types';
import { formatDuration } from './pipeline';

/** File, duration, error and GitLab artifact links of an automated result (spec §7: artifacts are linked, never copied). */
export function AutomatedResultDetails({ result }: { result: RunResult }) {
  const duration = formatDuration(result.durationMs);
  const artifactsUrl = result.status === 'FAILED' ? result.artifactsUrl : null;
  if (!result.file && !duration && !result.errorMessage && !artifactsUrl) return null;
  const reportUrl = artifactsUrl ? reportUrlFromArtifacts(artifactsUrl) : null;

  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      {(result.file || duration) && (
        <p className="text-xs text-muted-foreground">
          {result.file && <span className="font-mono">{result.file}</span>}
          {result.file && duration && ' · '}
          {duration}
        </p>
      )}
      {result.errorMessage && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Error</p>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-xs text-status-failed-fg">
            {result.errorMessage}
          </pre>
        </div>
      )}
      {artifactsUrl && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href={artifactsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Job artifacts (screenshots, traces)
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {reportUrl && (
            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Playwright HTML report
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
