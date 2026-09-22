import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '@/app/(app)/layout';
import { AutomationView } from '@/features/automation/automation-view';
import { api } from '@/lib/api';
import { safeNext } from '@/lib/safe-next';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { branchList, fileAt, linkedProject, mainBranch, repo, treeAt, workBranch } from '@/test/fixtures';
import { AuthProvider, useAuth } from './auth-provider';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/projects/NINJA/runs/run1' }));
const replace = nav.replace;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => nav.pathname,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/automation/code-editor', () => import('@/test/code-editor-mock'));

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

  it('marks a signed-in session as expired WITHOUT clearing cached data, so an open page keeps working', async () => {
    // Clearing the cache here used to be intentional ("don't leak data to whoever signs in next"), but
    // AppLayout keeps the current page mounted while `expired` — clearing removes the cache entry
    // behind every query still mounted on it, resetting each one to pending and unmounting that page's
    // content (e.g. the Automation tab's editor) just as surely as swapping in an error state would.
    const queryClient = new QueryClient();
    queryClient.setQueryData(['projects'], [{ id: 'p1' }]);
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(<Probe />, queryClient);
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await act(() => api('/projects').catch(() => undefined));
    expect(screen.getByText('expired:Tess')).toBeInTheDocument();
    expect(queryClient.getQueryData(['projects'])).toEqual([{ id: 'p1' }]);
  });

  it('clears cached data on an explicit logout', async () => {
    const queryClient = new QueryClient();
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(<Probe />, queryClient);
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();
    queryClient.setQueryData(['projects'], [{ id: 'p1' }]);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await act(() => auth.logout());
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('clears cached data when a different user logs in than was signed in before', async () => {
    const omar = { id: 'u2', name: 'Omar', email: 'omar@ejad.test', role: 'TESTER' };
    const queryClient = new QueryClient();
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(<Probe />, queryClient);
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();
    queryClient.setQueryData(['projects'], [{ id: 'p1' }]);

    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't2', user: omar }));
    await act(() => auth.login('omar@ejad.test', 'Passw0rd!'));
    expect(screen.getByText('authenticated:Omar')).toBeInTheDocument();
    expect(queryClient.getQueryData(['projects'])).toBeUndefined();
  });

  it('does not clear cached data when the same user signs back in (e.g. after "Sign in again" on expiry)', async () => {
    const queryClient = new QueryClient();
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't', user: tess }));
    renderWithProviders(<Probe />, queryClient);
    expect(await screen.findByText('authenticated:Tess')).toBeInTheDocument();
    queryClient.setQueryData(['projects'], [{ id: 'p1' }]);

    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 't2', user: tess }));
    await act(() => auth.login('tess@ejad.test', 'Passw0rd!'));
    expect(queryClient.getQueryData(['projects'])).toEqual([{ id: 'p1' }]);
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

  it('keeps a dirty Automation editor and its unsaved text mounted through session expiry, a re-render, and the "Sign in again" guard prompt', async () => {
    const here = '/projects/NINJA/automation';
    window.history.pushState({}, '', here);
    let refreshAttempts = 0;
    mockRoutes({
      'POST /auth/refresh': () => (refreshAttempts++ === 0 ? { accessToken: 't', user: tess } : apiError(401, 'Invalid or expired token')),
      'GET /trigger-expiry': () => apiError(401, 'Invalid or expired token'),
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeAt(workBranch.name, [{ path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' }]),
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
      'GET /projects/p1/automation/coverage': { ref: workBranch.name, commitId: 'abc', files: [], notAutomated: [] },
      'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml: 'ejad-playwright:\n' },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <AppLayout>
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </AppLayout>,
    );

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    // The session expires (e.g. a stale refresh cookie): AppLayout keeps everything mounted underneath.
    await act(() => api('/trigger-expiry').catch(() => undefined));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired – sign in again.');
    // Surviving the re-render this status change causes is the actual regression: clearing the query
    // cache here used to reset the Automation view's queries to pending and unmount the editor.
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');

    // "Sign in again" is a same-origin link; the still-dirty editor's own nav guard intercepts it.
    await user.click(screen.getByRole('link', { name: 'Sign in again' }));
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
  });
});
