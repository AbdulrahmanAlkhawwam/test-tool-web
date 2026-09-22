'use client';

import { CheckCircle2, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBar } from '@/components/status-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError, download } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { RunDetail } from '@/lib/types';
import { useUpdateRun } from './api';
import { AutomatedRunInfo } from './automated-run-info';

/** `unsavedCount`: results with an unsaved, in-flight or failed change — completing would lock them out. */
export function RunHeader({ run, unsavedCount = 0 }: { run: RunDetail; unsavedCount?: number }) {
  const complete = useUpdateRun(run.projectId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const s = run.summary;
  const blocked = unsavedCount > 0;

  async function completeRun() {
    if (blocked) return;
    try {
      await complete.mutateAsync({ id: run.id, input: { status: 'COMPLETED' } });
      toast.success('Run completed');
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not complete the run');
    }
  }

  async function exportResults() {
    setExporting(true);
    try {
      await download(`/runs/${run.id}/export`, `${run.project.key}-run.xlsx`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{run.name}</h2>
            {run.status === 'COMPLETED' ? (
              <Badge variant="secondary">Completed</Badge>
            ) : (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">In progress</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[run.type === 'AUTOMATED' ? 'Automated' : 'Manual', run.build, run.environment].filter(Boolean).join(' · ')} · started{' '}
            {formatDateTime(run.startedAt)} by {run.createdBy.name}
            {run.completedAt && ` · completed ${formatDateTime(run.completedAt)}`}
          </p>
          <AutomatedRunInfo run={run} className="mt-2" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={exporting} onClick={() => void exportResults()}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export results
          </Button>
          {run.status === 'IN_PROGRESS' && run.type !== 'AUTOMATED' && (
            <Button onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
              Complete run
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm" aria-live="polite">
          <span className="font-semibold tabular-nums">
            {s.executed} / {s.total}
          </span>{' '}
          executed · {s.passed} passed · {s.failed} failed · {s.blocked} blocked
          {s.skipped > 0 && ` · ${s.skipped} skipped`}
        </p>
        <StatusBar summary={s} className="h-2.5" />
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Complete this run?"
        description={
          blocked
            ? `${unsavedCount} result${unsavedCount === 1 ? ' has' : 's have'} unsaved changes – wait for ${unsavedCount === 1 ? 'it' : 'them'} to save before completing.`
            : s.notExecuted > 0
            ? `${s.notExecuted} test case${s.notExecuted === 1 ? ' is' : 's are'} still Not Executed. Completing locks all results.`
            : 'Completing locks all results. They can no longer be changed.'
        }
        confirmLabel="Complete run"
        pending={complete.isPending}
        confirmDisabled={blocked}
        onConfirm={() => void completeRun()}
      />
    </div>
  );
}
