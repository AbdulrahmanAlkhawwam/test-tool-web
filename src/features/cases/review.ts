import type { BulkApproveResult, ReviewState } from '@/lib/types';

/**
 * A missing `reviewState` means a case from before the AI phase, i.e. an ordinary approved one
 * (spec §5: the migration is additive and existing cases become APPROVED).
 */
export function isDraft(testCase: { reviewState?: ReviewState | null }): boolean {
  return testCase.reviewState === 'AI_DRAFT';
}

/**
 * Keeps only the ids still on screen. Paging or changing a filter swaps the rows, and "Approve
 * selected" must never send a draft the tester can no longer see. Returns the same array when nothing
 * changed, so it is safe to call from an effect that sets state.
 */
export function pruneSelection(selected: string[], visibleIds: string[]): string[] {
  const visible = new Set(visibleIds);
  const kept = selected.filter((id) => visible.has(id));
  return kept.length === selected.length ? selected : kept;
}

export interface ApprovalSummary {
  approved: number;
  failed: { id: string; message: string }[];
}

/**
 * Normalizes the bulk-approve response (spec §9: `POST /test-cases/approve`). Valid items are approved
 * even when some fail (spec §6, §10), so the response may list only the failures, only the approved
 * ids, or nothing at all — anything not reported as failed was approved.
 */
export function summarizeApproval(ids: string[], result: BulkApproveResult | undefined | null): ApprovalSummary {
  const failed = result?.failed ?? [];
  const failedIds = new Set(failed.map((f) => f.id));
  const reported = result?.approved ?? ids;
  return { approved: reported.filter((id) => !failedIds.has(id)).length, failed };
}

/** The toast text after a bulk approve. Never says "approved" without naming the failures. */
export function approvalMessage(summary: ApprovalSummary): string {
  const { approved, failed } = summary;
  if (!failed.length) return `${approved} ${approved === 1 ? 'draft' : 'drafts'} approved`;
  if (!approved) return `Could not approve: ${failed[0].message}`;
  return `${approved} approved, ${failed.length} failed: ${failed[0].message}`;
}
