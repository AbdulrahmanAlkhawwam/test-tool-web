'use client';

import { ArrowRight, Bot, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { PRIORITY_LABELS } from '@/lib/labels';
import type { Priority, SuggestionField } from '@/lib/types';
import { useAcceptSuggestion, useRejectSuggestion, useSuggestion } from './api';

const FIELD_LABELS: Record<SuggestionField, string> = {
  name: 'Name',
  description: 'Description',
  preconditions: 'Preconditions',
  steps: 'Test steps',
  testData: 'Test data',
  expectedResult: 'Expected result',
  priority: 'Priority',
  notes: 'Notes',
};

/** Same order as the case definition, so the panel reads like the case itself. */
const FIELD_ORDER: SuggestionField[] = ['name', 'description', 'preconditions', 'steps', 'testData', 'expectedResult', 'priority', 'notes'];

function displayValue(field: SuggestionField, value: string | null): string {
  if (value === null || value.trim() === '') return '—';
  if (field === 'priority') return PRIORITY_LABELS[value as Priority] ?? value;
  return value;
}

/**
 * "Suggested changes by AI" (spec §8): the AI's edits to an approved case, field by field, with the
 * rationale. Accept applies them; Reject drops them. Accept can come back 409 when the case changed
 * since the suggestion was written (spec §6) — the hook then refetches, so this panel redraws with the
 * case's current values instead of stale ones.
 */
export function SuggestionPanel({ caseId, projectId }: { caseId: string; projectId: string }) {
  const pending = useSuggestion(caseId);
  const accept = useAcceptSuggestion(projectId);
  const reject = useRejectSuggestion(projectId);
  const suggestion = pending.data;

  async function onAccept() {
    if (!suggestion) return;
    try {
      await accept.mutateAsync(suggestion.id);
      toast.success('Suggestion applied');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not apply the suggestion');
    }
  }

  async function onReject() {
    if (!suggestion) return;
    try {
      await reject.mutateAsync(suggestion.id);
      toast.success('Suggestion rejected');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not reject the suggestion');
    }
  }

  // The API's current select clause omits `status` entirely, so treat it tolerantly: render whenever
  // there's a suggestion, unless the API explicitly says it's no longer pending.
  if (!suggestion || (suggestion.status && suggestion.status !== 'PENDING')) return null;
  const fields = FIELD_ORDER.filter((field) => suggestion.changes[field]);
  const busy = accept.isPending || reject.isPending;

  return (
    <section aria-labelledby="suggestion-heading" className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="suggestion-heading" className="flex items-center gap-2 font-medium text-primary">
            <Bot className="h-4 w-4" aria-hidden />
            Suggested changes by AI
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Written by {suggestion.createdBy.name} via AI on {formatDateTime(suggestion.createdAt)}. The test case is unchanged until you accept.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void onAccept()}>
            <Check className="mr-1.5 h-4 w-4" aria-hidden />
            Accept
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void onReject()}>
            <X className="mr-1.5 h-4 w-4" aria-hidden />
            Reject
          </Button>
        </div>
      </div>

      {suggestion.rationale && <p className="rounded-md bg-card p-3 text-sm">{suggestion.rationale}</p>}

      <dl className="space-y-4">
        {fields.map((field) => {
          const change = suggestion.changes[field]!;
          return (
            <div key={field} className="space-y-1.5">
              <dt className="text-sm font-medium">{FIELD_LABELS[field]}</dt>
              <dd className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                {/* Strikethrough alone doesn't reach a screen reader: label each side so "old vs. new" is
                    audible, not just visible. */}
                <span className="whitespace-pre-wrap rounded-md bg-card p-3 text-sm text-muted-foreground line-through decoration-muted-foreground/50">
                  <span className="sr-only">Current: </span>
                  {displayValue(field, change.from)}
                </span>
                <ArrowRight className="mt-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
                <span className="whitespace-pre-wrap rounded-md bg-card p-3 text-sm">
                  <span className="sr-only">Suggested: </span>
                  {displayValue(field, change.to)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
