import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunPage from '@/app/(app)/projects/[key]/runs/[runId]/page';
import type { RunDetail, RunResult } from '@/lib/types';
import { runKeys } from './api';
import { summarizeResults } from './summary';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// jsdom has no ResizeObserver; the Radix Checkbox on the run page needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const result: RunResult = {
  id: 'r1',
  runId: 'run1',
  testCaseId: 'c1',
  title: null,
  status: 'NOT_EXECUTED',
  actualResult: null,
  notes: null,
  executedAt: null,
  executedBy: null,
  testCase: {
    id: 'c1',
    code: 'TC-AUTH-001',
    name: 'Login flow',
    description: null,
    preconditions: null,
    steps: null,
    testData: null,
    expectedResult: null,
    priority: 'MEDIUM',
    notes: null,
    deletedAt: null,
    module: { id: 'm1', name: 'Auth', code: 'AUTH' },
  },
};

const run: RunDetail = {
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
  summary: summarizeResults([result]),
  results: [result],
};

describe('RunPage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('keeps the loaded results (and unsaved text) mounted when a background refresh fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
    });
    queryClient.setQueryData(runKeys.detail('run1'), run);
    // Saves never finish here, so the typed text stays unsaved throughout.
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/runs/run1')
        ? json(500, { statusCode: 500, error: 'Internal Server Error', message: 'Boom' })
        : new Promise(() => undefined),
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <RunPage params={{ key: 'NINJA', runId: 'run1' }} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Login flow/ }));
    await user.type(screen.getByLabelText('Actual result'), 'Button does nothing');

    await act(() => queryClient.refetchQueries({ queryKey: runKeys.detail('run1') }));

    expect(queryClient.getQueryState(runKeys.detail('run1'))?.status).toBe('error');
    expect(await screen.findByText(/Couldn.t refresh this run/)).toBeInTheDocument();
    expect(screen.getByLabelText('Actual result')).toHaveValue('Button does nothing');
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });

  it('shows the error state when the run never loaded', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMock.mockImplementation(async () => json(404, { statusCode: 404, error: 'Not Found', message: 'Run not found' }));
    render(
      <QueryClientProvider client={queryClient}>
        <RunPage params={{ key: 'NINJA', runId: 'run1' }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Run not found/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Search in this run')).not.toBeInTheDocument();
  });
});
