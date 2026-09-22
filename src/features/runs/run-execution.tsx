'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RunDetail, RunResult } from '@/lib/types';
import { useUpdateResult } from './api';
import { CreateCaseFromResultDialog } from './create-case-from-result-dialog';
import { ResultRow } from './result-row';
import { RunHeader } from './run-header';

export function RunExecution({ run }: { run: RunDetail }) {
  const update = useUpdateResult(run.id, run.projectId);
  // Automated results come from GitLab's test report. The importer owns them, so they are never edited here (spec §7).
  const automated = run.type === 'AUTOMATED';
  const readOnly = run.status === 'COMPLETED' || automated;
  const [createFrom, setCreateFrom] = useState<RunResult | null>(null);
  const [search, setSearch] = useState('');
  // "Only not executed" snapshots the matching rows when switched on, so rows the tester
  // completes afterwards stay in place instead of disappearing (spec §8: nothing hides).
  const [onlyPending, setOnlyPending] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Rows with an unsaved, in-flight, or failed change. Rows only report when their dirty flag
  // flips (not on every keystroke), so mirroring the count into state is cheap; the header needs
  // it reactively to block completing the run while changes are unsaved.
  const dirtyIds = useRef<Set<string>>(new Set());
  const [dirtyCount, setDirtyCount] = useState(0);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return run.results.filter((r) => {
      if (onlyPending && !onlyPending.has(r.id)) return false;
      if (!term) return true;
      return `${r.testCase?.code ?? ''} ${r.testCase?.name ?? r.title ?? ''} ${r.testCase?.module.name ?? ''}`.toLowerCase().includes(term);
    });
  }, [run.results, search, onlyPending]);

  const visibleIds = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);
  const allExpanded = visible.length > 0 && visible.every((r) => expanded.has(r.id));

  const handleDirtyChange = useCallback((resultId: string, dirty: boolean) => {
    if (dirty) dirtyIds.current.add(resultId);
    else dirtyIds.current.delete(resultId);
    setDirtyCount(dirtyIds.current.size);
  }, []);

  // Warn before leaving the page while any row still has an unsaved or failed change (spec §8).
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyIds.current.size === 0) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="space-y-4">
      <RunHeader run={run} unsavedCount={dirtyCount} />
      {automated && run.status === 'IN_PROGRESS' ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Results arrive from GitLab when the pipeline finishes. This page refreshes every 10 seconds.
        </p>
      ) : (
        readOnly && (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            This run is completed. Results are read-only.
          </p>
        )
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Input type="search" placeholder="Search in this run" aria-label="Search in this run" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <Checkbox
            id="only-pending"
            checked={!!onlyPending}
            onCheckedChange={(on) => setOnlyPending(on === true ? new Set(run.results.filter((r) => r.status === 'NOT_EXECUTED').map((r) => r.id)) : null)}
          />
          <Label htmlFor="only-pending" className="font-normal">
            Only not executed
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(visible.map((r) => r.id)))}
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {visible.length === 0 && <EmptyState title="Nothing to show" description="No results match the current filters." />}
      {/* Every row stays mounted regardless of the filters above — only visually hidden — so a
          row's unsaved/saving/failed state isn't lost by unmounting it (spec §8). */}
      <ul className="space-y-2">
        {run.results.map((r) => (
          <ResultRow
            key={r.id}
            result={r}
            readOnly={readOnly}
            hidden={!visibleIds.has(r.id)}
            onSave={(patch) => update.mutateAsync({ resultId: r.id, patch })}
            expanded={expanded.has(r.id)}
            onExpandedChange={(open) =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (open) next.add(r.id);
                else next.delete(r.id);
                return next;
              })
            }
            onDirtyChange={handleDirtyChange}
            onCreateCase={automated && !r.testCaseId ? () => setCreateFrom(r) : undefined}
          />
        ))}
      </ul>
      <CreateCaseFromResultDialog run={run} result={createFrom} onClose={() => setCreateFrom(null)} />
    </div>
  );
}
