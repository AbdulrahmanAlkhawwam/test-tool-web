'use client';

import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationBranches, useAutomationTree, useCoverage } from '@/features/gitlab/api';
import { initialBranch, normalizeFolder } from '@/features/gitlab/paths';
import { safeExternalHref } from '@/lib/safe-external-href';
import type { ProjectDetail, RepositoryLink, SaveFileResult } from '@/lib/types';
import { setUnsavedChanges } from '@/lib/unsaved-changes';
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

type Change = { kind: 'branch'; branch: string } | { kind: 'file'; file: OpenFile } | { kind: 'nav'; href: string };

export function AutomationView({ project, repo, username }: AutomationViewProps) {
  const router = useRouter();
  const branches = useAutomationBranches(project.id);
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingChange, setPendingChange] = useState<Change | null>(null);
  const [lastSave, setLastSave] = useState<SaveFileResult | null>(null);

  // Pin the branch once its first derivation is known, instead of re-deriving it from initialBranch(...)
  // on every render: otherwise a later branches refetch (e.g. after the branch's MR is merged and the
  // branch deleted) would silently swap the open branch instead of leaving that to explicit user action
  // (spec: pin the branch once it is first chosen). Computed during render (not an effect) so the branch
  // is already correct on the very render where branches.data first arrives, with no extra tick/fetch delay.
  const pinnedBranch = useRef<string | null>(null);
  if (pinnedBranch.current === null && chosenBranch === null && branches.data) {
    pinnedBranch.current = initialBranch(branches.data.branches, username, repo.defaultBranch);
  }
  const branch = chosenBranch ?? pinnedBranch.current ?? '';

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
  // Only once branches.data has settled successfully (not mid-fetch, and not a failed refetch that fell
  // back to the last-loaded list) can its absence mean the pinned branch is truly gone, rather than a
  // save's new work branch not having refetched into the list yet, or a transient refetch error.
  const branchMissing =
    !!branch && !!branches.data && !branches.isFetching && !branches.isError && !branches.data.branches.some((b) => b.name === branch);

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

  // Publish this view's dirty state to the shared store so unrelated UI (the header's Log out) can ask
  // for confirmation too, instead of silently discarding the draft. Cleared on unmount so a stale "still
  // dirty" flag never outlives this view (e.g. after navigating away without going through the guard).
  useEffect(() => {
    setUnsavedChanges(dirty);
  }, [dirty]);
  useEffect(() => () => setUnsavedChanges(false), []);

  // Guard in-app navigation while the editor is dirty: a same-origin, unmodified left-click on an <a
  // href> normally navigates immediately, discarding the draft. Intercept it (capture phase, so it runs
  // before Next's own Link handler) and confirm first. External links and new-tab clicks are left alone.
  useEffect(() => {
    if (!dirty) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // A hash-only jump on the current page (e.g. <a href="#section">, or the same path with a
      // different/no hash) doesn't navigate away, so there's nothing to guard.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      // Stop the event here (capture phase, before it reaches the link): otherwise it would still bubble
      // up to Next's own Link click handler, which navigates regardless of an earlier preventDefault.
      e.stopPropagation();
      setPendingChange({ kind: 'nav', href: `${url.pathname}${url.search}${url.hash}` });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  // Only show the full error state when the branch list has never loaded. A background refetch failure
  // (e.g. after the tab regains focus) instead falls through below: a small banner, editor stays mounted
  // (spec: a failed background refetch must not unmount the editor).
  if (branches.isPending) return <LoadingState label="Loading branches…" />;
  if (!branches.data) return branches.isError ? <ErrorState error={branches.error} onRetry={() => branches.refetch()} /> : <LoadingState label="Loading branches…" />;

  function apply(change: Change) {
    if (change.kind === 'branch') {
      setChosenBranch(change.branch);
      setOpenFile(null);
    } else if (change.kind === 'file') {
      setOpenFile(change.file);
    } else {
      // Clear dirty (and the shared store) before navigating away, not after: the confirm just given
      // is the explicit "yes, discard" the store's consumers (e.g. the header's Log out) are for, so
      // nothing should still see this view as dirty once that navigation is under way.
      setDirty(false);
      setUnsavedChanges(false);
      router.push(change.href);
      return;
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
      {branches.isError && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
          Couldn&apos;t refresh branches – showing the last loaded list.
          <Button variant="link" size="sm" className="h-auto p-0 text-status-blocked-fg" disabled={branches.isFetching} onClick={() => void branches.refetch()}>
            {branches.isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </p>
      )}
      {branchMissing && (
        <p role="alert" className="rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
          This branch no longer exists in GitLab – copy your changes or switch branch.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <BranchSelect branches={branches.data.branches} value={branch} onChange={(next) => request({ kind: 'branch', branch: next })} />
        {mergeRequest && <MergeRequestLink mergeRequest={mergeRequest} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <RunTestsDialog
            project={project}
            repo={repo}
            initialBranch={branch}
            initialPath={openFile && !openFile.isNew ? openFile.path : undefined}
            dirty={dirty}
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
