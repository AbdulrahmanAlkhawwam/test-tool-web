import { describe, expect, it } from 'vitest';
import type { ProjectReport, RunSummary } from '@/lib/types';
import { toBreakdownData, toTrendData } from './chart-data';

const summary = (over: Partial<RunSummary>): RunSummary => ({
  total: 0, executed: 0, notExecuted: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, passRate: 0, ...over,
});

describe('chart data', () => {
  it('maps runs to trend points, leaving pass rate empty for runs with nothing executed', () => {
    const trend: ProjectReport['trend'] = [
      { id: 'r1', name: 'Sprint 1', type: 'MANUAL', status: 'COMPLETED', startedAt: '2026-01-01T00:00:00.000Z', summary: summary({ total: 3, executed: 3, passed: 2, failed: 1, passRate: 66.7 }) },
      { id: 'r2', name: 'Sprint 2', type: 'MANUAL', status: 'IN_PROGRESS', startedAt: '2026-02-01T00:00:00.000Z', summary: summary({ total: 3, notExecuted: 3 }) },
    ];
    expect(toTrendData(trend)).toEqual([
      { id: 'r1', name: 'Sprint 1', passRate: 66.7, executed: 3, total: 3 },
      { id: 'r2', name: 'Sprint 2', passRate: null, executed: 0, total: 3 },
    ]);
  });

  it('maps breakdown rows to stacked-bar rows', () => {
    const rows = [{ moduleId: 'm1', name: 'Authentication', code: 'AUTH', summary: summary({ total: 4, passed: 2, failed: 1, notExecuted: 1 }) }];
    expect(toBreakdownData(rows, (r) => r.name)).toEqual([
      { label: 'Authentication', passed: 2, failed: 1, blocked: 0, skipped: 0, notExecuted: 1 },
    ]);
  });
});
