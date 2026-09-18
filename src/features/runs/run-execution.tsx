'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RunDetail } from '@/lib/types';
import { useUpdateResult } from './api';
import { ResultRow } from './result-row';
import { RunHeader } from './run-header';

export function RunExecution({ run }: { run: RunDetail }) {
  const update = useUpdateResult(run.id, run.projectId);
  const readOnly = run.status === 'COMPLETED';
  const [search, setSearch] = useState('');
  // "Only not executed" snapshots the matching rows when switched on, so rows the tester
  // completes afterwards stay in place instead of disappearing (spec §8: nothing hides).
  const [onlyPending, setOnlyPending] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return run.results.filter((r) => {
      if (onlyPending && !onlyPending.has(r.id)) return false;
      if (!term) return true;
      return `${r.testCase?.code ?? ''} ${r.testCase?.name ?? r.title ?? ''} ${r.testCase?.module.name ?? ''}`.toLowerCase().includes(term);
    });
  }, [run.results, search, onlyPending]);

  const allExpanded = visible.length > 0 && visible.every((r) => expanded.has(r.id));

  return (
    <div className="space-y-4">
      <RunHeader run={run} />
      {readOnly && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This run is completed. Results are read-only.
        </p>
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
      {visible.length === 0 ? (
        <EmptyState title="Nothing to show" description="No results match the current filters." />
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <ResultRow
              key={r.id}
              result={r}
              readOnly={readOnly}
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
