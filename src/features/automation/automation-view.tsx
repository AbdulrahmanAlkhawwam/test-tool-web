'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationBranches, useAutomationTree } from '@/features/gitlab/api';
import { initialBranch, normalizeFolder } from '@/features/gitlab/paths';
import type { ProjectDetail, RepositoryLink } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { buildFileTree } from './file-tree';
import { FileTreeView } from './file-tree-view';
import { MergeRequestLink } from './merge-request-link';

interface AutomationViewProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** The current user's GitLab username (their work branches are tests/<username>-<slug>). */
  username: string;
}

export function AutomationView({ project, repo, username }: AutomationViewProps) {
  const branches = useAutomationBranches(project.id);
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const branch = chosenBranch ?? (branches.data ? initialBranch(branches.data.branches, username, repo.defaultBranch) : '');
  const tree = useAutomationTree(project.id, branch);
  const nodes = useMemo(() => buildFileTree(tree.data?.entries ?? [], repo.testsPath), [tree.data, repo.testsPath]);

  if (branches.isPending) return <LoadingState label="Loading branches…" />;
  if (branches.isError) return <ErrorState error={branches.error} onRetry={() => branches.refetch()} />;

  const current = branches.data.branches.find((b) => b.name === branch);

  function changeBranch(next: string) {
    setChosenBranch(next);
    setSelectedPath(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <BranchSelect branches={branches.data.branches} value={branch} onChange={changeBranch} />
        {current?.mergeRequest && <MergeRequestLink mergeRequest={current.mergeRequest} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" asChild>
            <a href={repo.gitlabWebUrl} target="_blank" rel="noopener noreferrer">
              Open in GitLab
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Tests folder" className="min-w-0 rounded-xl border bg-card p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tests folder <span className="font-mono normal-case">{normalizeFolder(repo.testsPath)}</span>
          </p>
          {tree.isPending ? (
            <LoadingState label="Loading files…" />
          ) : tree.isError ? (
            <ErrorState error={tree.error} onRetry={() => tree.refetch()} />
          ) : nodes.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">No files in this folder on this branch yet.</p>
          ) : (
            <FileTreeView nodes={nodes} testsPath={repo.testsPath} selectedPath={selectedPath} onSelect={setSelectedPath} />
          )}
        </section>
        <section aria-label="Editor" className="min-w-0 rounded-xl border bg-card p-4">
          {selectedPath ? (
            <p className="font-mono text-sm">{selectedPath}</p>
          ) : (
            <EmptyState title="Select a file" description="Choose a test file on the left to open it." />
          )}
        </section>
      </div>
    </div>
  );
}
