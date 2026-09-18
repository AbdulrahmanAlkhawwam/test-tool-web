import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-provider';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const tess = { id: 'u1', name: 'Tess', email: 'tess@ejad.test', role: 'TESTER' };

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return <p>{`${auth.status}:${auth.user?.name ?? '-'}`}</p>;
}

function renderWithProviders() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('restores the session from the refresh cookie', async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: 't', user: tess }));
    renderWithProviders();
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();
  });

  it('is unauthenticated when refresh fails, then logs in and out', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, error: 'Unauthorized', message: 'Missing refresh token' }));
    renderWithProviders();
    expect(await screen.findByText('unauthenticated:-')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    await act(() => auth.login('tess@ejad.test', 'Passw0rd!'));
    expect(screen.getByText('authenticated:Tess')).toBeInTheDocument();
    expect(auth.isAdmin).toBe(false);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await act(() => auth.logout());
    expect(screen.getByText('unauthenticated:-')).toBeInTheDocument();
  });
});
