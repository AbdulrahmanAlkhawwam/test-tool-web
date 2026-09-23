import { describe, expect, it } from 'vitest';
import { approvalMessage, isDraft, pruneSelection, summarizeApproval } from './review';

describe('isDraft', () => {
  it('is true only for AI_DRAFT, and treats a missing reviewState as approved', () => {
    expect(isDraft({ reviewState: 'AI_DRAFT' })).toBe(true);
    expect(isDraft({ reviewState: 'APPROVED' })).toBe(false);
    expect(isDraft({})).toBe(false);
    expect(isDraft({ reviewState: null })).toBe(false);
  });
});

describe('pruneSelection', () => {
  it('drops ids that are no longer on screen and keeps the same array when nothing changed', () => {
    const selected = ['c1', 'c2'];
    expect(pruneSelection(selected, ['c1', 'c2', 'c3'])).toBe(selected);
    expect(pruneSelection(selected, ['c2', 'c9'])).toEqual(['c2']);
    expect(pruneSelection(selected, [])).toEqual([]);
  });
});

describe('summarizeApproval', () => {
  it('counts every id as approved when the API reports nothing', () => {
    expect(summarizeApproval(['c1', 'c2'], {})).toEqual({ approved: 2, failed: [] });
    expect(summarizeApproval(['c1'], undefined)).toEqual({ approved: 1, failed: [] });
  });

  it('separates the failures, whether or not the API also lists the approved ids', () => {
    const failed = [{ id: 'c2', message: 'TC-AUTH-002 was already approved' }];
    expect(summarizeApproval(['c1', 'c2'], { failed })).toEqual({ approved: 1, failed });
    expect(summarizeApproval(['c1', 'c2'], { approved: ['c1'], failed })).toEqual({ approved: 1, failed });
    // A failure the API also lists as approved must not be counted twice.
    expect(summarizeApproval(['c1', 'c2'], { approved: ['c1', 'c2'], failed })).toEqual({ approved: 1, failed });
  });
});

describe('approvalMessage', () => {
  it('says what happened instead of claiming everything worked', () => {
    expect(approvalMessage({ approved: 1, failed: [] })).toBe('1 draft approved');
    expect(approvalMessage({ approved: 3, failed: [] })).toBe('3 drafts approved');
    expect(approvalMessage({ approved: 0, failed: [{ id: 'c2', message: 'Already approved' }] })).toBe('Could not approve: Already approved');
    expect(approvalMessage({ approved: 3, failed: [{ id: 'c2', message: 'Already approved' }] })).toBe('3 approved, 1 failed: Already approved');
  });
});
