'use client';

import { Bot, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { TestCaseDetail } from '@/lib/types';
import { useApproveCase, useDeleteCase } from './api';

/**
 * The AI-draft banner on a test case page (spec §8). Approve makes the case real; Reject soft-deletes it
 * (spec §6) and hands control back to the caller, which leaves the page. The live region wraps only the
 * status text, not the buttons — a screen reader announcing this region on every change should not also
 * re-announce interactive controls (Task 5 review carry-over).
 */
export function DraftBanner({
  testCase,
  projectId,
  onRejected,
}: {
  testCase: TestCaseDetail;
  projectId: string;
  onRejected: () => void;
}) {
  const approve = useApproveCase(projectId);
  const del = useDeleteCase(projectId);
  const [rejectOpen, setRejectOpen] = useState(false);
  // Lock Approve and Reject against each other while either mutation is in flight, the same way
  // SuggestionPanel's `busy` does — otherwise a tester could fire both at once (Task 6 review carry-over).
  const busy = approve.isPending || del.isPending;

  async function onApprove() {
    try {
      await approve.mutateAsync(testCase.id);
      toast.success(`${testCase.code} approved`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not approve the test case');
    }
  }

  async function onReject() {
    try {
      await del.mutateAsync(testCase.id);
      toast.success(`${testCase.code} rejected`);
      setRejectOpen(false);
      onRejected();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not reject the draft');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
        <span role="status" className="flex items-center gap-2 text-primary">
          <Bot className="h-4 w-4 shrink-0" aria-hidden />
          This is an AI draft. It stays out of runs, reports, dashboard counts and exports until someone approves it.
        </span>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void onApprove()}>
            <Check className="mr-1.5 h-4 w-4" aria-hidden />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setRejectOpen(true)}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden />
            Reject
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${testCase.code}?`}
        description="The draft is thrown away and its ID is never reused. The AI can write a new draft any time."
        confirmLabel="Reject"
        destructive
        pending={del.isPending}
        onConfirm={() => void onReject()}
      />
    </>
  );
}
