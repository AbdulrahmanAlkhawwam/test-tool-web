import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '@/lib/format';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { apiToken } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { TokenList } from './token-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('TokenList', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('invites the tester to create one when there are none', async () => {
    mockRoutes({ 'GET /users/me/tokens': [] });
    renderWithClient(<TokenList />);

    expect(await screen.findByText('No AI tokens yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the name, prefix, created, last used and expiry of each token', async () => {
    const expiresAt = '2026-12-21T09:00:00.000Z';
    mockRoutes({ 'GET /users/me/tokens': [apiToken({ expiresAt, lastUsedAt: null })] });
    renderWithClient(<TokenList />);

    expect(await screen.findByText('Amina laptop')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4…')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-09-01T09:00:00.000Z'))).toBeInTheDocument();
    expect(screen.getByText('Never used')).toBeInTheDocument();
    // Absolute local date, never the raw ISO value, with the relative form as the cell's hint.
    const expiry = screen.getByText(formatDateTime(expiresAt));
    expect(expiry).toBeInTheDocument();
    expect(expiry).toHaveAttribute('title', expect.stringContaining('Expires in'));
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('revokes a token and stops showing it as active', async () => {
    let revoked = false;
    const { callsTo } = mockRoutes({
      'GET /users/me/tokens': () => [revoked ? apiToken({ revokedAt: '2026-09-22T12:00:00.000Z' }) : apiToken()],
      'DELETE /users/me/tokens/t1': () => {
        revoked = true;
        return new Response(null, { status: 204 });
      },
    });
    const user = userEvent.setup();
    renderWithClient(<TokenList />);

    await user.click(await screen.findByRole('button', { name: 'Revoke Amina laptop' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Active')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Revoke Amina laptop' })).not.toBeInTheDocument();
    expect(callsTo('DELETE', '/users/me/tokens/t1')).toHaveLength(1);
  });

  it('marks a token whose expiry has passed and offers no Revoke for it', async () => {
    mockRoutes({ 'GET /users/me/tokens': [apiToken({ expiresAt: '2020-01-01T00:00:00.000Z' })] });
    renderWithClient(<TokenList />);

    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke Amina laptop' })).not.toBeInTheDocument();
  });

  it('shows the API’s message when revoking fails and leaves the row alone', async () => {
    const { toast } = await import('sonner');
    mockRoutes({
      'GET /users/me/tokens': [apiToken()],
      'DELETE /users/me/tokens/t1': () => apiError(404, 'Token not found'),
    });
    const user = userEvent.setup();
    renderWithClient(<TokenList />);

    await user.click(await screen.findByRole('button', { name: 'Revoke Amina laptop' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Token not found'));
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('disables the confirm dialog buttons while the revoke is in flight', async () => {
    let resolveDelete!: () => void;
    mockRoutes({
      'GET /users/me/tokens': [apiToken()],
      'DELETE /users/me/tokens/t1': () =>
        new Promise((resolve) => {
          resolveDelete = () => resolve(new Response(null, { status: 204 }));
        }),
    });
    const user = userEvent.setup();
    renderWithClient(<TokenList />);

    await user.click(await screen.findByRole('button', { name: 'Revoke Amina laptop' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveDelete();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Working…' })).not.toBeInTheDocument());
  });

  it('renders a token that is both revoked and past its expiry as revoked, with no Revoke offered', async () => {
    mockRoutes({
      'GET /users/me/tokens': [apiToken({ expiresAt: '2020-01-01T00:00:00.000Z', revokedAt: '2020-06-01T00:00:00.000Z' })],
    });
    renderWithClient(<TokenList />);

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke Amina laptop' })).not.toBeInTheDocument();
  });
});
