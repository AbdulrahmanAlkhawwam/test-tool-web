'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { PriorityBadge } from '@/components/priority-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/labels';
import type { ResultStatus, RunResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { ResultPatch } from './api';
import { SaveIndicator } from './save-indicator';
import { useAutoSave } from './use-auto-save';

const STATUS_CHOICES: ResultStatus[] = ['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED', 'NOT_EXECUTED'];

const CHOICE_STYLE: Record<ResultStatus, string> = {
  PASSED: 'peer-checked:bg-status-passed peer-checked:text-white peer-checked:border-status-passed',
  FAILED: 'peer-checked:bg-status-failed peer-checked:text-white peer-checked:border-status-failed',
  BLOCKED: 'peer-checked:bg-status-blocked peer-checked:text-white peer-checked:border-status-blocked',
  SKIPPED: 'peer-checked:bg-status-skipped peer-checked:text-white peer-checked:border-status-skipped',
  NOT_EXECUTED: 'peer-checked:bg-muted peer-checked:text-foreground peer-checked:border-foreground/30',
};

const ROW_ACCENT: Record<ResultStatus, string> = {
  PASSED: 'border-l-status-passed',
  FAILED: 'border-l-status-failed',
  BLOCKED: 'border-l-status-blocked',
  SKIPPED: 'border-l-status-skipped',
  NOT_EXECUTED: 'border-l-transparent',
};

interface ResultRowProps {
  result: RunResult;
  readOnly: boolean;
  onSave: (patch: ResultPatch) => Promise<unknown>;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value?.trim() ? value : '—'}</p>
    </div>
  );
}

export function ResultRow({ result, readOnly, onSave, expanded, onExpandedChange }: ResultRowProps) {
  const id = useId();
  const tc = result.testCase;
  const [status, setStatus] = useState(result.status);
  const [actual, setActual] = useState(result.actualResult ?? '');
  const [notes, setNotes] = useState(result.notes ?? '');
  const actualRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const autoSave = useAutoSave<ResultPatch>(onSave);

  // Adopt changes from other testers (refetch) unless the user is editing that field.
  useEffect(() => setStatus(result.status), [result.status]);
  useEffect(() => {
    if (document.activeElement !== actualRef.current) setActual(result.actualResult ?? '');
  }, [result.actualResult]);
  useEffect(() => {
    if (document.activeElement !== notesRef.current) setNotes(result.notes ?? '');
  }, [result.notes]);

  function chooseStatus(next: ResultStatus) {
    setStatus(next);
    autoSave.queue({ status: next }, { immediate: true });
  }

  return (
    <li className={cn('rounded-lg border border-l-4 bg-card', ROW_ACCENT[status])}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          onClick={() => onExpandedChange(!expanded)}
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden />
          <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{tc?.code ?? 'Unlinked'}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{tc?.name ?? result.title}</span>
            {tc && <span className="block text-xs text-muted-foreground">{tc.module.name}</span>}
          </span>
        </button>
        {tc && <PriorityBadge priority={tc.priority} />}

        <fieldset className="flex flex-wrap gap-1" disabled={readOnly}>
          <legend className="sr-only">Result status for {tc?.code ?? result.title}</legend>
          {STATUS_CHOICES.map((choice) => (
            <label key={choice} className="relative">
              <input
                type="radio"
                name={`${id}-status`}
                value={choice}
                checked={status === choice}
                onChange={() => chooseStatus(choice)}
                className="peer sr-only"
                aria-label={STATUS_LABELS[choice]}
              />
              <span
                className={cn(
                  'inline-block cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
                  CHOICE_STYLE[choice],
                )}
                aria-hidden
              >
                {STATUS_LABELS[choice]}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex w-40 flex-col items-end text-right">
          <SaveIndicator state={autoSave.state} onRetry={() => void autoSave.retry()} />
          {result.executedBy && (
            <span className="text-xs text-muted-foreground">
              {result.executedBy.name} · {formatDateTime(result.executedAt)}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div id={`${id}-body`} className="grid gap-6 border-t px-4 py-4 md:grid-cols-2">
          <div className="space-y-3">
            {tc ? (
              <>
                <Field label="Preconditions" value={tc.preconditions} />
                <Field label="Test steps" value={tc.steps} />
                <Field label="Test data" value={tc.testData} />
                <Field label="Expected result" value={tc.expectedResult} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This automated test isn&apos;t linked to a test case.</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-actual`} className="text-xs font-medium text-muted-foreground">
                Actual result
              </label>
              <Textarea
                id={`${id}-actual`}
                ref={actualRef}
                rows={3}
                readOnly={readOnly}
                placeholder="What actually happened (e.g. Like expected result)"
                value={actual}
                onChange={(e) => {
                  setActual(e.target.value);
                  autoSave.queue({ actualResult: e.target.value });
                }}
                onBlur={() => void autoSave.flush()}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-notes`} className="text-xs font-medium text-muted-foreground">
                Notes
              </label>
              <Textarea
                id={`${id}-notes`}
                ref={notesRef}
                rows={2}
                readOnly={readOnly}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  autoSave.queue({ notes: e.target.value });
                }}
                onBlur={() => void autoSave.flush()}
              />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
