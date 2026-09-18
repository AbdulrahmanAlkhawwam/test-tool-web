import type { ResultStatus, RunSummary } from '@/lib/types';

export function summarizeResults(results: { status: ResultStatus }[]): RunSummary {
  const count = (s: ResultStatus) => results.filter((r) => r.status === s).length;
  const passed = count('PASSED');
  const failed = count('FAILED');
  const blocked = count('BLOCKED');
  const skipped = count('SKIPPED');
  const notExecuted = count('NOT_EXECUTED');
  const executed = passed + failed + blocked + skipped;
  return {
    total: results.length,
    executed,
    notExecuted,
    passed,
    failed,
    blocked,
    skipped,
    passRate: executed ? Math.round((passed / executed) * 1000) / 10 : 0,
  };
}
