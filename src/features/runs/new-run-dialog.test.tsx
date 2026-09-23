import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDetail } from '@/lib/types';
import { caseItem, pagedCases } from '@/test/fixtures';
import { NewRunDialog } from './new-run-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const project: ProjectDetail = {
  id: 'p1',
  name: 'Ninja',
  key: 'NINJA',
  description: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  modules: [],
};

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewRunDialog project={project} />
    </QueryClientProvider>,
  );
}

describe('NewRunDialog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('resets the selection back to "All test cases" when reopened after being closed', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'New run' }));
    await userEvent.click(screen.getByLabelText('By priority'));
    expect(screen.getByLabelText('By priority')).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'New run' }));

    expect(screen.getByLabelText('All test cases')).toBeChecked();
  });

  it('never offers an AI draft when picking cases for a run', async () => {
    let reviewState: string | null = null;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/test-cases')) return Promise.resolve(json(200, []));
      reviewState = url.searchParams.get('reviewState');
      return Promise.resolve(
        json(
          200,
          pagedCases(
            [
              caseItem('c1', 'TC-AUTH-001'),
              // The API is asked for approved cases only; if it ever forgets, the picker still drops this one.
              caseItem('c2', 'TC-AUTH-002', { reviewState: 'AI_DRAFT' }),
            ],
            { pageSize: 200 },
          ),
        ),
      );
    });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'New run' }));
    await userEvent.click(screen.getByLabelText('Pick test cases'));

    expect(await screen.findByLabelText(/TC-AUTH-001/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/TC-AUTH-002/)).not.toBeInTheDocument();
    expect(reviewState).toBe('APPROVED');
  });
});
