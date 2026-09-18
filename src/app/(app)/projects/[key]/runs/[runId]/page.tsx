'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/page-state';
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
      {run.isPending ? <LoadingState /> : run.isError ? <ErrorState error={run.error} onRetry={() => run.refetch()} /> : <RunExecution run={run.data} />}
    </div>
  );
}
