'use client';

import { Play, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAutomationBranches, useAutomationTree, useRunAutomated } from '@/features/gitlab/api';
import { normalizeFolder } from '@/features/gitlab/paths';
import { CasePicker } from '@/features/runs/new-run-dialog';
import { ApiError } from '@/lib/api';
import type { AutomatedScopeMode, ProjectDetail, RepositoryLink } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { buildScope, scopeError, type ScopeState } from './run-scope';

const MODES: { value: AutomatedScopeMode; label: string }[] = [
  { value: 'ALL', label: 'All tests' },
  { value: 'PATH', label: 'A folder or file' },
  { value: 'CASES', label: 'Selected test cases' },
];

interface RunTestsDialogProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** Preselected when the dialog opens, e.g. the Automation tab's branch and open file. */
  initialBranch?: string;
  initialPath?: string;
  triggerVariant?: 'default' | 'outline';
  /** True while the Automation editor has unsaved changes: the pipeline runs the committed code, not the draft. */
  dirty?: boolean;
}

/** Starts a GitLab CI pipeline as the current user and opens the new automated run (spec §7). */
export function RunTestsDialog({ project, repo, initialBranch, initialPath, triggerVariant = 'default', dirty }: RunTestsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [branch, setBranch] = useState(initialBranch || repo.defaultBranch);
  const [scope, setScope] = useState<ScopeState>({ mode: 'ALL', path: initialPath ?? normalizeFolder(repo.testsPath), caseIds: [] });
  const branches = useAutomationBranches(project.id, open);
  const tree = useAutomationTree(project.id, open ? branch : '');
  const start = useRunAutomated(project.id);
  const error = scopeError(scope, repo.testsPath);
  const canSubmit = !!branch && !error && !start.isPending;

  function reset() {
    setBranch(initialBranch || repo.defaultBranch);
    setScope({ mode: 'ALL', path: initialPath ?? normalizeFolder(repo.testsPath), caseIds: [] });
  }

  function toggleCase(id: string) {
    setScope((s) => ({ ...s, caseIds: s.caseIds.includes(id) ? s.caseIds.filter((c) => c !== id) : [...s.caseIds, id] }));
  }

  async function runPipeline() {
    try {
      const run = await start.mutateAsync({ branch, scope: buildScope(scope) });
      setOpen(false);
      const runHref = `/projects/${project.key}/runs/${run.id}`;
      if (dirty) {
        // Don't navigate away from a dirty editor just because a pipeline started: that would discard
        // the draft the same way the old direct router.push did. Stay put and let the user open the run
        // when they're ready (spec: unsaved changes are never silently lost).
        toast.success('Pipeline started', { action: { label: 'Open run', onClick: () => router.push(runHref) } });
      } else {
        router.push(runHref);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the tests');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // The pipeline runs whatever is committed on the branch, not the editor's unsaved draft: confirm
    // that's expected before starting (spec: unsaved changes must never be silently lost or ignored).
    if (dirty) {
      setConfirmStart(true);
      return;
    }
    await runPipeline();
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) reset();
        }}
      >
        <DialogTrigger asChild>
          <Button variant={triggerVariant}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden />
            Run tests
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Run automated tests</DialogTitle>
            <DialogDescription>
              Starts a GitLab CI pipeline with your GitLab account. A new automated run shows the pipeline status, and its results
              appear when the pipeline finishes.
            </DialogDescription>
          </DialogHeader>
          <form id="run-tests-form" onSubmit={submit} className="space-y-4">
            {dirty && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked-fg">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                The pipeline runs the code committed on the branch, not your unsaved changes – they&apos;ll stay right here in the
                editor.
              </p>
            )}
            <BranchSelect id="run-tests-branch" branches={branches.data?.branches ?? []} value={branch} onChange={setBranch} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tests to run</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map((m) => (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="run-tests-scope"
                      value={m.value}
                      checked={scope.mode === m.value}
                      onChange={() => setScope({ ...scope, mode: m.value })}
                      className="accent-[hsl(var(--primary))]"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              {scope.mode === 'PATH' && (
                <div className="space-y-1.5">
                  <Label htmlFor="run-tests-path">Folder or file</Label>
                  <Input
                    id="run-tests-path"
                    list="run-tests-paths"
                    className="font-mono"
                    value={scope.path}
                    onChange={(e) => setScope({ ...scope, path: e.target.value })}
                  />
                  <datalist id="run-tests-paths">
                    {(tree.data?.entries ?? []).map((entry) => (
                      <option key={entry.path} value={entry.path} />
                    ))}
                  </datalist>
                </div>
              )}
              {scope.mode === 'CASES' && (
                <>
                  <CasePicker projectId={project.id} selected={scope.caseIds} onToggle={toggleCase} />
                  <p className="text-xs text-muted-foreground">Runs the tests whose titles carry these cases&apos; tags, e.g. @TC-AUTH-001.</p>
                </>
              )}
              {error && <p className="text-xs text-muted-foreground">{error}</p>}
            </fieldset>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="run-tests-form" disabled={!canSubmit}>
              {start.isPending ? 'Starting…' : 'Start pipeline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmStart}
        onOpenChange={setConfirmStart}
        title="Start the pipeline?"
        description="It runs the code already committed on the branch, not your unsaved changes here. Your changes stay in the editor and won't be lost."
        confirmLabel="Start pipeline"
        pending={start.isPending}
        onConfirm={() => void runPipeline()}
      />
    </>
  );
}
