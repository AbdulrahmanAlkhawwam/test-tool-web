import type { Priority, ResultStatus } from './types';

export const STATUS_ORDER: ResultStatus[] = ['NOT_EXECUTED', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED'];
export const PRIORITY_ORDER: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];

export const STATUS_LABELS: Record<ResultStatus, string> = {
  NOT_EXECUTED: 'Not Executed',
  PASSED: 'Passed',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
  SKIPPED: 'Skipped',
};

export const PRIORITY_LABELS: Record<Priority, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
