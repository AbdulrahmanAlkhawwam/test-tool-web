'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useRun } from '@/features/runs/api';
import { RunExecution } from '@/features/runs/run-execution';

export default function RunPage({ params }: { params: { key: string; runId: string } }) {
  const run = useRun(params.runId);
  return (
    <div className="space-y-4">
      <Link href={`/projects/${params.key}/runs`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All runs
      </Link>
      {/* Once loaded, the results stay mounted even if a background refetch fails: swapping them for
          an error state would unmount rows and lose unsaved text (spec §8). */}
      {run.data ? (
        <>
          {run.isError && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
              Couldn&apos;t refresh this run – showing the last loaded results.
              <Button variant="link" size="sm" className="h-auto p-0 text-status-blocked-fg" disabled={run.isFetching} onClick={() => void run.refetch()}>
                {run.isFetching ? 'Retrying…' : 'Retry'}
              </Button>
            </p>
          )}
          <RunExecution run={run.data} />
        </>
      ) : run.isError ? (
        <ErrorState error={run.error} onRetry={() => run.refetch()} />
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
