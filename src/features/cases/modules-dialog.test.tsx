import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleSummary } from '@/lib/types';
import { ModulesDialog } from './modules-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const modules: ModuleSummary[] = [{ id: 'm1', name: 'Authentication', code: 'AUTH', caseCount: 0 }];

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ModulesDialog projectId="p1" modules={modules} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe('ModulesDialog', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('reverts the name input to the server value when the rename is rejected', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { statusCode: 409, error: 'Conflict', message: 'Module code "AUTH" already exists in this project' }),
    );

    renderDialog();
    const input = screen.getByLabelText('Name of module AUTH') as HTMLInputElement;
    expect(input.value).toBe('Authentication');

    await userEvent.clear(input);
    await userEvent.type(input, 'Auth v2');
    fireEvent.blur(input);

    await waitFor(() => expect(input.value).toBe('Authentication'));
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
