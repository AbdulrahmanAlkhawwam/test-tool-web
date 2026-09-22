'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationBranches, useAutomationTree, useCoverage } from '@/features/gitlab/api';
import { initialBranch, normalizeFolder } from '@/features/gitlab/paths';
import { safeExternalHref } from '@/lib/safe-external-href';
import type { ProjectDetail, RepositoryLink, SaveFileResult } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { CiSnippet } from './ci-snippet';
import { CoverageSection } from './coverage-section';
import { EditorPanel } from './editor-panel';
import { buildFileTree } from './file-tree';
import { FileTreeView } from './file-tree-view';
import { MergeRequestLink } from './merge-request-link';
import { NewFileDialog } from './new-file-dialog';
import { RunTestsDialog } from './run-tests-dialog';

interface AutomationViewProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** The current user's GitLab username (their work branches are tests/<username>/<slug>). */
  username: string;
}

interface OpenFile {
  path: string;
  isNew: boolean;
}

type Change = { kind: 'branch'; branch: string } | { kind: 'file'; file: OpenFile };

export function AutomationView({ project, repo, username }: AutomationViewProps) {
  const branches = useAutomationBranches(project.id);
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingChange, setPendingChange] = useState<Change | null>(null);
  const [lastSave, setLastSave] = useState<SaveFileResult | null>(null);
  const branch = chosenBranch ?? (branches.data ? initialBranch(branches.data.branches, username, repo.defaultBranch) : '');
  const tree = useAutomationTree(project.id, branch);
  const nodes = useMemo(() => buildFileTree(tree.data?.entries ?? [], repo.testsPath), [tree.data, repo.testsPath]);
  const existingPaths = useMemo(
    () => new Set((tree.data?.entries ?? []).filter((e) => e.type === 'blob').map((e) => normalizeFolder(e.path))),
    [tree.data],
  );
  const current = branches.data?.branches.find((b) => b.name === branch);
  // Right after the first save the branch list may not have refetched yet, so fall back to the save's MR.
  const mergeRequest = current?.mergeRequest ?? (lastSave?.branch === branch ? lastSave.mergeRequest : null);
  const coverage = useCoverage(project.id, branch);
  const caseCounts = useMemo(
    () => Object.fromEntries((coverage.data?.files ?? []).map((f) => [f.path, f.cases.length])),
    [coverage.data],
  );

  // Warn before leaving the page with unsaved editor changes.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (branches.isPending) return <LoadingState label="Loading branches…" />;
  if (branches.isError) return <ErrorState error={branches.error} onRetry={() => branches.refetch()} />;

  function apply(change: Change) {
    if (change.kind === 'branch') {
      setChosenBranch(change.branch);
      setOpenFile(null);
    } else {
      setOpenFile(change.file);
    }
    setDirty(false);
  }

  function request(change: Change) {
    if (dirty) setPendingChange(change);
    else apply(change);
  }

  function handleSaved(result: SaveFileResult) {
    setLastSave(result);
    setChosenBranch(result.branch);
    setOpenFile((f) => (f ? { path: f.path, isNew: false } : f));
  }

  function openFromCoverage(path: string) {
    if (path !== openFile?.path || openFile.isNew) request({ kind: 'file', file: { path, isNew: false } });
    document.getElementById('automation-editor')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <BranchSelect branches={branches.data.branches} value={branch} onChange={(next) => request({ kind: 'branch', branch: next })} />
        {mergeRequest && <MergeRequestLink mergeRequest={mergeRequest} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <RunTestsDialog
            project={project}
            repo={repo}
            initialBranch={branch}
            initialPath={openFile && !openFile.isNew ? openFile.path : undefined}
          />
          <NewFileDialog
            testsPath={repo.testsPath}
            existing={existingPaths}
            onCreate={(path) => request({ kind: 'file', file: { path, isNew: true } })}
          />
          {safeExternalHref(repo.gitlabWebUrl) && (
            <Button variant="ghost" asChild>
              <a href={safeExternalHref(repo.gitlabWebUrl)} target="_blank" rel="noopener noreferrer">
                Open in GitLab
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          )}
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
            <FileTreeView
              key={`${repo.testsPath}:${branch}`}
              nodes={nodes}
              testsPath={repo.testsPath}
              selectedPath={openFile?.path ?? null}
              caseCounts={caseCounts}
              onSelect={(path) => {
                if (path !== openFile?.path) request({ kind: 'file', file: { path, isNew: false } });
              }}
            />
          )}
        </section>
        <section id="automation-editor" aria-label="Editor" className="min-w-0 rounded-xl border bg-card p-4">
          {openFile ? (
            <EditorPanel
              key={`${branch}:${openFile.path}:${openFile.isNew ? 'new' : 'existing'}`}
              projectId={project.id}
              branch={branch}
              path={openFile.path}
              isNew={openFile.isNew}
              username={username}
              onSaved={handleSaved}
              onDirtyChange={setDirty}
            />
          ) : (
            <EmptyState title="Select a file" description="Choose a test file on the left to open it, or create a new one." />
          )}
        </section>
      </div>
      <CoverageSection projectId={project.id} projectKey={project.key} gitRef={branch} onOpenFile={openFromCoverage} />
      <CiSnippet projectId={project.id} />
      <ConfirmDialog
        open={!!pendingChange}
        onOpenChange={(o) => {
          if (!o) setPendingChange(null);
        }}
        title="Discard unsaved changes?"
        description={`Your changes to ${openFile?.path ?? 'this file'} haven't been saved.`}
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          if (pendingChange) apply(pendingChange);
          setPendingChange(null);
        }}
      />
    </div>
  );
}
