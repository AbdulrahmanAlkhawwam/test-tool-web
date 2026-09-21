import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, mockRoutes } from '@/test/fetch-routes';
import { createWrapper, renderWithClient } from '@/test/render';
import GitlabCallbackPage from './page';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));

describe('GitlabCallbackPage', () => {
  beforeEach(() => {
    nav.search = '';
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a connecting message while it completes the OAuth flow', async () => {
    nav.search = 'code=abc123&state=s1';
    mockRoutes({ 'POST /gitlab/oauth/complete': { status: 'connected', username: 'amina' } });
    renderWithClient(<GitlabCallbackPage />);
    expect(screen.getByText('Connecting GitLab…')).toBeInTheDocument();
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  });

  it('posts the code and state, and redirects to the connected profile on success', async () => {
    nav.search = 'code=abc123&state=s1';
    const { callsTo } = mockRoutes({ 'POST /gitlab/oauth/complete': { status: 'connected', username: 'amina' } });
    renderWithClient(<GitlabCallbackPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/profile?gitlab=connected'));
    expect(callsTo('POST', '/gitlab/oauth/complete')[0].body).toEqual({ state: 's1', code: 'abc123' });
  });

  it.each([
    ['denied', 'denied'],
    ['already_linked', 'already_linked'],
    ['exchange_failed', 'exchange_failed'],
  ])('redirects to the error profile with reason=%s when the API rejects with that reason', async (apiReason, expectedReason) => {
    nav.search = 'code=abc123&state=s1';
    mockRoutes({
      'POST /gitlab/oauth/complete': () =>
        json(400, { statusCode: 400, error: 'Bad Request', message: 'nope', details: { reason: apiReason } }),
    });
    renderWithClient(<GitlabCallbackPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/profile?gitlab=error&reason=${expectedReason}`));
  });

  it('falls back to exchange_failed when the failure has no recognizable reason', async () => {
    nav.search = 'code=abc123&state=s1';
    mockRoutes({ 'POST /gitlab/oauth/complete': () => json(500, { statusCode: 500, error: 'Server Error', message: 'boom' }) });
    renderWithClient(<GitlabCallbackPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/profile?gitlab=error&reason=exchange_failed'));
  });

  it('passes GitLab\'s error straight through to the API, which maps access_denied to denied', async () => {
    nav.search = 'error=access_denied&state=s1';
    const { callsTo } = mockRoutes({
      'POST /gitlab/oauth/complete': () =>
        json(400, { statusCode: 400, error: 'Bad Request', message: 'Access denied', details: { reason: 'denied' } }),
    });
    renderWithClient(<GitlabCallbackPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/profile?gitlab=error&reason=denied'));
    expect(callsTo('POST', '/gitlab/oauth/complete')[0].body).toEqual({ state: 's1', error: 'access_denied' });
  });

  it('redirects straight to invalid_state without calling the API when state is missing', async () => {
    nav.search = 'code=abc123';
    const { calls } = mockRoutes({});
    renderWithClient(<GitlabCallbackPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/profile?gitlab=error&reason=invalid_state'));
    expect(calls).toHaveLength(0);
  });

  it('posts only once even when effects run twice, as React StrictMode does in development', async () => {
    nav.search = 'code=abc123&state=s1';
    const { callsTo } = mockRoutes({ 'POST /gitlab/oauth/complete': { status: 'connected', username: 'amina' } });
    const { wrapper: QueryWrapper } = createWrapper();
    render(
      <StrictMode>
        <QueryWrapper>
          <GitlabCallbackPage />
        </QueryWrapper>
      </StrictMode>,
    );
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/profile?gitlab=connected'));
    expect(callsTo('POST', '/gitlab/oauth/complete')).toHaveLength(1);
  });
});
