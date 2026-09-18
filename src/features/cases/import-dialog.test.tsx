import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDetail } from '@/lib/types';
import { ImportDialog } from './import-dialog';

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
      <ImportDialog project={project} />
    </QueryClientProvider>,
  );
}

describe('ImportDialog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('clears the file input after a failed preview so the same file can be re-selected', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Could not find a header row with "ID" and "Test Case Name" columns',
      }),
    );

    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    const input = screen.getByLabelText('File') as HTMLInputElement;
    const file = new File(['dummy'], 'cases.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await userEvent.upload(input, file);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(input.value).toBe('');
  });
});
