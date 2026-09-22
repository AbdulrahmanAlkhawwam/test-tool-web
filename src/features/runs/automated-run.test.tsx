import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunDetail, RunResult } from '@/lib/types';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { RunExecution } from './run-execution';
import { summarizeResults } from './summary';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom has no ResizeObserver. The Radix "Only not executed" checkbox needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const loginCase = {
  id: 'c1',
  code: 'TC-AUTH-001',
  name: 'Login with email',
  description: null,
  preconditions: null,
  steps: null,
  testData: null,
  expectedResult: null,
  priority: 'HIGH' as const,
  notes: null,
  deletedAt: null,
  module: { id: 'm1', name: 'Authentication', code: 'AUTH' },
};

function result(over: Partial<RunResult>): RunResult {
  return {
    id: 'r1',
    runId: 'run1',
    testCaseId: 'c1',
    title: null,
    status: 'PASSED',
    actualResult: null,
    notes: null,
    executedAt: '2026-09-18T10:05:00.000Z',
    executedBy: { id: 'u1', name: 'Amina' },
    testCase: loginCase,
    ...over,
  };
}

function automatedRun(over: Partial<RunDetail>, results: RunResult[] = []): RunDetail {
  return {
    id: 'run1',
    projectId: 'p1',
    name: 'Automated run',
    build: null,
    environment: null,
    type: 'AUTOMATED',
    status: 'COMPLETED',
    startedAt: '2026-09-18T10:00:00.000Z',
    completedAt: '2026-09-18T10:06:00.000Z',
    branch: 'main',
    pipelineId: 123,
    pipelineWebUrl: 'https://git.ejad.net/mobile/ninja-store/-/pipelines/123',
    pipelineStatus: 'success',
    note: null,
    project: { id: 'p1', key: 'NINJA', name: 'Ninja Store' },
    createdBy: { id: 'u1', name: 'Amina' },
    summary: summarizeResults(results),
    results,
    ...over,
  };
}

describe('Automated run screen', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the branch and a live pipeline link while the pipeline runs, without manual controls', () => {
    mockRoutes({});
    renderWithClient(<RunExecution run={automatedRun({ status: 'IN_PROGRESS', completedAt: null, pipelineStatus: 'running' })} />);

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pipeline #123' })).toHaveAttribute(
      'href',
      'https://git.ejad.net/mobile/ninja-store/-/pipelines/123',
    );
    expect(screen.getByText(/Results arrive from GitLab when the pipeline finishes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete run' })).not.toBeInTheDocument();
  });

  it("shows the importer's note on a finished run", () => {
    mockRoutes({});
    const jobUrl = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55';
    renderWithClient(<RunExecution run={automatedRun({ pipelineStatus: 'failed', note: `Pipeline finished without a test report – ${jobUrl}` })} />);

    expect(screen.getByText(/Pipeline finished without a test report/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: jobUrl })).toHaveAttribute('href', jobUrl);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/This run is completed/)).toBeInTheDocument();
  });

  it('links a failed result to its job artifacts and the Playwright report', async () => {
    mockRoutes({});
    const failed = result({
      status: 'FAILED',
      errorMessage: 'expect(received).toBe(expected)',
      durationMs: 4200,
      file: 'e2e/auth/login.spec.ts',
      artifactsUrl: 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/browse',
    });
    const user = userEvent.setup();
    renderWithClient(<RunExecution run={automatedRun({ pipelineStatus: 'failed' }, [failed])} />);

    expect(screen.getByRole('link', { name: 'Artifacts' })).toHaveAttribute('href', failed.artifactsUrl);
    await user.click(screen.getByRole('button', { name: /TC-AUTH-001/ }));
    expect(screen.getByText('expect(received).toBe(expected)')).toBeInTheDocument();
    expect(screen.getByText(/4\.2 s/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Playwright HTML report' })).toHaveAttribute(
      'href',
      'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/file/playwright-report/index.html',
    );
  });

  it('hides "Create test case from this" when GitLab automation is disabled on this server', async () => {
    const unlinked = result({ id: 'r2', testCaseId: null, testCase: null, title: 'checkout pays with card', file: 'e2e/checkout/pay.spec.ts' });
    mockRoutes({ 'GET /gitlab/status': { enabled: false, connection: null } });
    renderWithClient(<RunExecution run={automatedRun({}, [unlinked])} />);

    await waitFor(() => expect(screen.getByText('checkout pays with card')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create test case from this' })).not.toBeInTheDocument();
  });

  it('creates a test case from an unlinked result', async () => {
    const unlinked = result({
      id: 'r2',
      testCaseId: null,
      testCase: null,
      title: 'checkout pays with card @smoke',
      file: 'e2e/checkout/pay.spec.ts',
    });
    const { callsTo } = mockRoutes({
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
      'GET /projects/p1/modules': [
        { id: 'm1', name: 'Authentication', code: 'AUTH', caseCount: 3 },
        { id: 'm2', name: 'Checkout', code: 'CHK', caseCount: 0 },
      ],
      'POST /runs/run1/results/r2/create-case': {
        testCase: { id: 'c9', code: 'TC-CHK-001', name: 'checkout pays with card' },
        resultId: 'r2',
        tag: '@TC-CHK-001',
      },
    });
    const user = userEvent.setup();
    renderWithClient(<RunExecution run={automatedRun({}, [unlinked])} />);

    await user.click(await screen.findByRole('button', { name: 'Create test case from this' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Test case name')).toHaveValue('checkout pays with card');
    await waitFor(() => expect(within(dialog).getByLabelText('Module')).toHaveValue('m2'));
    await user.click(within(dialog).getByRole('button', { name: 'Create test case' }));

    await waitFor(() => expect(callsTo('POST', '/runs/run1/results/r2/create-case')).toHaveLength(1));
    expect(callsTo('POST', '/runs/run1/results/r2/create-case')[0].body).toEqual({ name: 'checkout pays with card', moduleId: 'm2' });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Created TC-CHK-001. Add @TC-CHK-001 to the test's title so the next run links it."),
    );
  });
});
