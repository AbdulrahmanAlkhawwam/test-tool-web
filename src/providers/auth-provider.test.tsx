import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '@/app/(app)/layout';
import { api } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';
import { AuthProvider, useAuth } from './auth-provider';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/projects/NINJA/runs/run1' }));
const replace = nav.replace;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => json(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
const tess = { id: 'u1', name: 'Tess', email: 'tess@ejad.test', role: 'TESTER' };

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return <p>{`${auth.status}:${auth.user?.name ?? '-'}`}</p>;
}

function renderWithProviders(children: React.ReactNode = <Probe />, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
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
    replace.mockReset();
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

  it('marks a signed-in session as expired and clears cached data when renewal is rejected', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['projects'], [{ id: 'p1' }]);
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(<Probe />, queryClient);
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await act(() => api('/projects').catch(() => undefined));
    expect(screen.getByText('expired:Tess')).toBeInTheDocument();
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('stays signed in when renewal fails for a transient reason', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders();
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(unauthorized()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(() => api('/projects').catch(() => undefined));
    expect(screen.getByText('authenticated:Tess')).toBeInTheDocument();
  });
});

describe('AppLayout', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    nav.pathname = '/projects/NINJA/runs/run1';
    vi.unstubAllGlobals();
  });

  it('keeps the query string when redirecting an unauthenticated visit to login', async () => {
    // The GitLab OAuth callback is the case that matters most: its `?code=&state=` must survive the
    // round trip through login, or the exchange the callback page needs to complete is lost.
    const here = '/gitlab/callback?code=a&state=b';
    window.history.pushState({}, '', here);
    nav.pathname = '/gitlab/callback';
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, error: 'Unauthorized', message: 'Missing refresh token' }));
    renderWithProviders(
      <AppLayout>
        <p>child</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const href = replace.mock.calls[0][0] as string;
    expect(href).toBe(`/login?next=${encodeURIComponent(here)}`);
    // The login page reads it back through searchParams + safeNext and lands on the same place.
    expect(safeNext(new URL(href, window.location.origin).searchParams.get('next'))).toBe(here);
  });

  it('keeps the page mounted and asks to sign in again when the session expires', async () => {
    const here = '/projects/NINJA/runs/run1?q=login';
    window.history.pushState({}, '', here);
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(
      <AppLayout>
        <textarea aria-label="Actual result" defaultValue="Unsaved text" />
      </AppLayout>,
    );
    expect(await screen.findByLabelText('Actual result')).toHaveValue('Unsaved text');

    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await act(() => api('/projects').catch(() => undefined));

    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired – sign in again.');
    const href = screen.getByRole('link', { name: 'Sign in again' }).getAttribute('href') ?? '';
    expect(href).toBe(`/login?next=${encodeURIComponent(here)}`);
    // The login page reads it back through searchParams + safeNext and lands on the same place.
    expect(safeNext(new URL(href, window.location.origin).searchParams.get('next'))).toBe(here);
    expect(screen.getByLabelText('Actual result')).toHaveValue('Unsaved text');
    expect(replace).not.toHaveBeenCalled();
  });
});
