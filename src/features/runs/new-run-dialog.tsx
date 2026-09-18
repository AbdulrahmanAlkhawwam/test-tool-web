'use client';

import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCases, useModules } from '@/features/cases/api';
import { ApiError } from '@/lib/api';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/labels';
import type { ProjectDetail, SelectionMode } from '@/lib/types';
import { useCreateRun } from './api';
import { buildSelection, defaultRunName, selectionError, SelectionState } from './run-selection';

const MODES: { value: SelectionMode; label: string }[] = [
  { value: 'ALL', label: 'All test cases' },
  { value: 'MODULES', label: 'By module' },
  { value: 'PRIORITIES', label: 'By priority' },
  { value: 'CASES', label: 'Pick test cases' },
];

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Mounted only in "Pick test cases" mode, so the case list is fetched only when needed. */
function CasePicker({ projectId, selected, onToggle }: { projectId: string; selected: string[]; onToggle: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const cases = useCases(projectId, { q: search || undefined, page: 1, pageSize: 200 });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Input type="search" placeholder="Search test cases" aria-label="Search test cases to pick" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-56 space-y-1.5 overflow-y-auto">
        {(cases.data?.items ?? []).map((tc) => (
          <div key={tc.id} className="flex items-center gap-2">
            <Checkbox id={`case-${tc.id}`} checked={selected.includes(tc.id)} onCheckedChange={() => onToggle(tc.id)} />
            <Label htmlFor={`case-${tc.id}`} className="font-normal">
              <span className="font-mono text-xs text-muted-foreground">{tc.code}</span> {tc.name}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{selected.length} selected</p>
    </div>
  );
}

export function NewRunDialog({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultRunName());
  const [build, setBuild] = useState('');
  const [environment, setEnvironment] = useState('');
  const [selection, setSelection] = useState<SelectionState>({ mode: 'ALL', moduleIds: [], priorities: [], caseIds: [] });
  const modules = useModules(project.id);
  const create = useCreateRun(project.id);

  const error = selectionError(selection);
  const canSubmit = !!name.trim() && !error && !create.isPending;

  function resetForm() {
    setName(defaultRunName());
    setBuild('');
    setEnvironment('');
    setSelection({ mode: 'ALL', moduleIds: [], priorities: [], caseIds: [] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const run = await create.mutateAsync({
        name: name.trim(),
        build: build.trim() || undefined,
        environment: environment.trim() || undefined,
        selection: buildSelection(selection),
      });
      setOpen(false);
      router.push(`/projects/${project.key}/runs/${run.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the run');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Play className="mr-1.5 h-4 w-4" aria-hidden />
          New run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New test run</DialogTitle>
          <DialogDescription>The run takes a snapshot of the chosen test cases. Cases added later won&apos;t be part of it.</DialogDescription>
        </DialogHeader>
        <form id="new-run" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="run-name">Name</Label>
            <Input id="run-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="run-build">Build / version (optional)</Label>
              <Input id="run-build" placeholder="v1.4.0" value={build} onChange={(e) => setBuild(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-env">Environment (optional)</Label>
              <Input id="run-env" placeholder="staging" value={environment} onChange={(e) => setEnvironment(e.target.value)} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Test cases to include</legend>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <label key={m.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    checked={selection.mode === m.value}
                    onChange={() => setSelection({ ...selection, mode: m.value })}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {m.label}
                </label>
              ))}
            </div>

            {selection.mode === 'MODULES' && (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-3">
                {(modules.data ?? project.modules).map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`mod-${m.id}`}
                      checked={selection.moduleIds.includes(m.id)}
                      onCheckedChange={() => setSelection({ ...selection, moduleIds: toggle(selection.moduleIds, m.id) })}
                    />
                    <Label htmlFor={`mod-${m.id}`} className="font-normal">
                      {m.name} <span className="text-muted-foreground">({m.caseCount})</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {selection.mode === 'PRIORITIES' && (
              <div className="flex gap-4 rounded-md border p-3">
                {PRIORITY_ORDER.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox
                      id={`prio-${p}`}
                      checked={selection.priorities.includes(p)}
                      onCheckedChange={() => setSelection({ ...selection, priorities: toggle(selection.priorities, p) })}
                    />
                    <Label htmlFor={`prio-${p}`} className="font-normal">
                      {PRIORITY_LABELS[p]}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {selection.mode === 'CASES' && (
              <CasePicker
                projectId={project.id}
                selected={selection.caseIds}
                onToggle={(id) => setSelection({ ...selection, caseIds: toggle(selection.caseIds, id) })}
              />
            )}
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-run" disabled={!canSubmit}>
            {create.isPending ? 'Creating…' : 'Start run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
