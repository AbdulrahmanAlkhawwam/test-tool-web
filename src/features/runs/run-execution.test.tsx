import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunDetail, RunResult } from '@/lib/types';
import { RunExecution } from './run-execution';
import { summarizeResults } from './summary';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// jsdom has no ResizeObserver; the "Only not executed" Checkbox is Radix-based and needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const baseCase = {
  id: 'c-default',
  code: 'TC-1',
  name: 'Default case',
  description: null,
  preconditions: null,
  steps: null,
  testData: null,
  expectedResult: null,
  priority: 'MEDIUM' as const,
  notes: null,
  deletedAt: null,
  module: { id: 'm1', name: 'Auth', code: 'AUTH' },
};

function makeResult(over: Partial<RunResult> & { code: string; name: string }): RunResult {
  const { code, name, ...rest } = over;
  return {
    id: 'r-default',
    runId: 'run1',
    testCaseId: 'c-default',
    title: null,
    status: 'NOT_EXECUTED',
    actualResult: null,
    notes: null,
    executedAt: null,
    executedBy: null,
    testCase: { ...baseCase, code, name },
    ...rest,
  };
}

function makeRun(results: RunResult[]): RunDetail {
  return {
    id: 'run1',
    projectId: 'p1',
    name: 'Sprint 1',
    build: null,
    environment: null,
    type: 'MANUAL',
    status: 'IN_PROGRESS',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    project: { id: 'p1', key: 'NINJA', name: 'Ninja' },
    createdBy: { id: 'u1', name: 'Amina' },
    summary: summarizeResults(results),
    results,
  };
}

function renderExecution(run: RunDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RunExecution run={run} />
    </QueryClientProvider>,
  );
}

describe('RunExecution', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(json(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('keeps a row mounted (hidden) instead of removing it when a search filters it out', async () => {
    const results = [
      makeResult({ id: 'r1', code: 'TC-1', name: 'Login flow' }),
      makeResult({ id: 'r2', code: 'TC-2', name: 'Logout flow' }),
    ];
    const user = userEvent.setup();
    renderExecution(makeRun(results));

    await user.type(screen.getByLabelText('Search in this run'), 'Login');

    const loginRow = screen.getByText('TC-1').closest('li');
    const logoutRow = screen.getByText('TC-2').closest('li');
    expect(loginRow).not.toHaveAttribute('hidden');
    expect(logoutRow).toHaveAttribute('hidden');
  });

  it('keeps a row visible after marking it Passed while "Only not executed" is on', async () => {
    const results = [
      makeResult({ id: 'r1', status: 'NOT_EXECUTED', code: 'TC-1', name: 'Login flow' }),
      makeResult({ id: 'r2', status: 'PASSED', code: 'TC-2', name: 'Logout flow' }),
    ];
    fetchMock.mockResolvedValue(json(200, { ...results[0], status: 'PASSED' }));
    const user = userEvent.setup();
    renderExecution(makeRun(results));

    await user.click(screen.getByLabelText('Only not executed'));

    const row1 = screen.getByText('TC-1').closest('li') as HTMLElement;
    const row2 = screen.getByText('TC-2').closest('li') as HTMLElement;
    expect(row1).not.toHaveAttribute('hidden');
    expect(row2).toHaveAttribute('hidden');

    await user.click(within(row1).getByRole('radio', { name: 'Passed' }));

    expect(await within(row1).findByText('Saved ✓')).toBeInTheDocument();
    expect(row1).not.toHaveAttribute('hidden');
  });
});
