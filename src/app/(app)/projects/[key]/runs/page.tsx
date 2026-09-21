'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { RunTestsDialog } from '@/features/automation/run-tests-dialog';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';
import { useRuns } from '@/features/runs/api';
import { NewRunDialog } from '@/features/runs/new-run-dialog';
import { RunList } from '@/features/runs/run-list';

export default function RunsPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const runs = useRuns(project.data?.id ?? '');
  const gitlab = useGitlabStatus();
  if (!project.data) return null;
  // "Run tests" needs a linked repository and an active GitLab connection (spec §7). The Automation tab explains how to get one.
  const access = automationAccess(gitlab.data, project.data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each run records one pass through a set of test cases, e.g. per sprint or build.</p>
        <div className="flex gap-2">
          {access.state === 'ready' && <RunTestsDialog project={project.data} repo={access.repo} triggerVariant="outline" />}
          <NewRunDialog project={project.data} />
        </div>
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
