import { describe, expect, it } from 'vitest';
import type { ResultStatus } from '@/lib/types';
import { summarizeResults } from './summary';

describe('summarizeResults', () => {
  it('matches the API summary formula', () => {
    const statuses: ResultStatus[] = ['PASSED', 'PASSED', 'FAILED', 'NOT_EXECUTED', 'BLOCKED', 'SKIPPED', 'NOT_EXECUTED'];
    expect(summarizeResults(statuses.map((status) => ({ status })))).toEqual({
      total: 7, executed: 5, notExecuted: 2, passed: 2, failed: 1, blocked: 1, skipped: 1, passRate: 40,
    });
  });

  it('handles an empty run', () => {
    expect(summarizeResults([]).passRate).toBe(0);
  });
});
