'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModules } from '@/features/cases/api';
import { useCreateCaseFromResult } from '@/features/gitlab/api';
import { ApiError } from '@/lib/api';
import type { RunDetail, RunResult } from '@/lib/types';
import { CASE_NAME_MAX_LENGTH, caseNameFromTitle, guessModuleId } from './module-guess';

interface CreateCaseFromResultDialogProps {
  run: RunDetail;
  /** The Unlinked result to turn into a test case. The dialog is open while this is set. */
  result: RunResult | null;
  onClose: () => void;
}

export function CreateCaseFromResultDialog({ run, result, onClose }: CreateCaseFromResultDialogProps) {
  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">{result && <CreateCaseForm key={result.id} run={run} result={result} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CreateCaseForm({ run, result, onDone }: { run: RunDetail; result: RunResult; onDone: () => void }) {
  const modules = useModules(run.projectId);
  const create = useCreateCaseFromResult(run.id, run.projectId);
  const [name, setName] = useState(() => caseNameFromTitle(result.title));
  const [moduleId, setModuleId] = useState<string | null>(null);
  const list = modules.data ?? [];
  // Pre-filled from the test's file path until the user picks a module.
  const chosenModule = moduleId ?? guessModuleId(result.file, list);
  const trimmedName = name.trim();
  const nameError = !trimmedName ? 'Enter a name' : trimmedName.length > CASE_NAME_MAX_LENGTH ? `At most ${CASE_NAME_MAX_LENGTH} characters` : null;
  const canSubmit = !nameError && !!chosenModule && !create.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const created = await create.mutateAsync({ resultId: result.id, input: { name: trimmedName, moduleId: chosenModule } });
      toast.success(`Created ${created.testCase.code}. Add ${created.tag} to the test's title so the next run links it.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the test case');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create test case from this</DialogTitle>
        <DialogDescription>Adds a test case for this automated test. You can fill in the steps and expected result later.</DialogDescription>
      </DialogHeader>
      <form id="create-case-from-result" onSubmit={submit} className="space-y-4">
        {result.file && <p className="break-all font-mono text-xs text-muted-foreground">{result.file}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="create-case-name">Test case name</Label>
          <Input id="create-case-name" maxLength={CASE_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} />
          {name.trim() && nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-case-module">Module</Label>
          <select
            id="create-case-module"
            value={chosenModule}
            onChange={(e) => setModuleId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {list.length === 0 && <option value="">No modules yet. Add one on the Test Cases tab.</option>}
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code})
              </option>
            ))}
          </select>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="create-case-from-result" disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create test case'}
        </Button>
      </DialogFooter>
    </>
  );
}
