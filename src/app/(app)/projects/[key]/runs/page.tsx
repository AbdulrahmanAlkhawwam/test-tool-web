'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { useProject } from '@/features/projects/api';
import { useRuns } from '@/features/runs/api';
import { NewRunDialog } from '@/features/runs/new-run-dialog';
import { RunList } from '@/features/runs/run-list';

export default function RunsPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const runs = useRuns(project.data?.id ?? '');
  if (!project.data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each run records one pass through a set of test cases, e.g. per sprint or build.</p>
        <NewRunDialog project={project.data} />
      </div>
      {runs.isPending ? (
        <LoadingState />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
      ) : runs.data.length === 0 ? (
        <EmptyState title="No runs yet" description="Start a run to execute the test cases and record results." />
      ) : (
        <RunList projectKey={project.data.key} runs={runs.data} />
      )}
    </div>
  );
}
