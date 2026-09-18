import type { ProjectReport, RunSummary } from '@/lib/types';

/** Hex values matching the --status-* tokens (SVG fills can't read CSS variables reliably). */
export const STATUS_CHART_COLORS = {
  passed: '#44D581',
  failed: '#E05252',
  blocked: '#F2A516',
  skipped: '#8A97A8',
  notExecuted: '#D5DCE5',
} as const;

export const STATUS_SERIES = [
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'notExecuted', label: 'Not Executed' },
] as const;

export interface TrendPoint {
  id: string;
  name: string;
  passRate: number | null;
  executed: number;
  total: number;
}

export function toTrendData(trend: ProjectReport['trend']): TrendPoint[] {
  return trend.map((run) => ({
    id: run.id,
    name: run.name,
    passRate: run.summary.executed ? run.summary.passRate : null,
    executed: run.summary.executed,
    total: run.summary.total,
  }));
}

export interface BreakdownRow {
  label: string;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notExecuted: number;
}

export function toBreakdownData<T extends { summary: RunSummary }>(rows: T[], labelOf: (row: T) => string): BreakdownRow[] {
  return rows.map((row) => ({
    label: labelOf(row),
    passed: row.summary.passed,
    failed: row.summary.failed,
    blocked: row.summary.blocked,
    skipped: row.summary.skipped,
    notExecuted: row.summary.notExecuted,
  }));
}
