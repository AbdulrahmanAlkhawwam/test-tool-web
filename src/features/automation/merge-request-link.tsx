import { ExternalLink, GitPullRequest } from 'lucide-react';
import { safeExternalHref } from '@/lib/safe-external-href';
import type { MergeRequestRef } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATES: Record<string, { label: string; className: string }> = {
  opened: { label: 'Open', className: 'bg-status-passed/15 text-status-passed-fg' },
  merged: { label: 'Merged', className: 'bg-primary/10 text-primary' },
  closed: { label: 'Closed', className: 'bg-status-skipped/15 text-status-skipped-fg' },
  locked: { label: 'Locked', className: 'bg-status-blocked/20 text-status-blocked-fg' },
};

export function MergeRequestLink({ mergeRequest }: { mergeRequest: MergeRequestRef }) {
  const state = STATES[mergeRequest.state] ?? { label: mergeRequest.state, className: 'bg-muted text-muted-foreground' };
  const href = safeExternalHref(mergeRequest.webUrl);
  const badge = <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium no-underline', state.className)}>{state.label}</span>;

  if (!href) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <GitPullRequest className="h-4 w-4" aria-hidden />
        Merge request !{mergeRequest.iid}
        {badge}
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
      <GitPullRequest className="h-4 w-4" aria-hidden />
      Merge request !{mergeRequest.iid}
      {badge}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
