import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, json, mockRoutes } from '@/test/fetch-routes';
import { apiToken } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AiAccessCard } from './ai-access-card';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'ejad_pat_0123456789abcdef0123456789abcdef';

/** Empty list first, then one token, like the API after a create. */
function routes(extra: Record<string, unknown> = {}) {
  let listed = 0;
  return mockRoutes({
    'GET /users/me/tokens': () => (listed++ === 0 ? [] : [apiToken()]),
    'POST /users/me/tokens': { ...apiToken(), token: TOKEN },
    ...extra,
  });
}

async function createToken(user: ReturnType<typeof userEvent.setup>, name = 'Amina laptop') {
  await user.click(await screen.findByRole('button', { name: 'New token' }));
  await user.type(await screen.findByLabelText('Token name'), name);
  await user.click(screen.getByRole('button', { name: 'Create token' }));
}

describe('AiAccessCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates a token, shows it once and copies it', async () => {
    const { callsTo } = routes();
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);

    await createToken(user);

    expect(await screen.findByText(TOKEN)).toBeInTheDocument();
    expect(screen.getByText(/You will not see this token again/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy token' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(TOKEN);
    expect(callsTo('POST', '/users/me/tokens')[0].body).toEqual({ name: 'Amina laptop', expiresInDays: 90 });
  });

  it('shows the API’s message when creating a token fails', async () => {
    const { toast } = await import('sonner');
    routes({ 'POST /users/me/tokens': () => apiError(422, 'A token named "Amina laptop" already exists') });
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);

    await createToken(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('A token named "Amina laptop" already exists'),
    );
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it('disables the name input and the expiry select while the create mutation is pending', async () => {
    let resolveCreate!: (value: unknown) => void;
    routes({
      'POST /users/me/tokens': () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    });
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);

    await user.click(await screen.findByRole('button', { name: 'New token' }));
    await user.type(await screen.findByLabelText('Token name'), 'Amina laptop');
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    await waitFor(() => expect(screen.getByLabelText('Token name')).toBeDisabled());
    expect(screen.getByLabelText('Expires after')).toBeDisabled();

    resolveCreate(json(200, { ...apiToken(), token: TOKEN }));
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();
  });

  it('defaults the expiry to 90 days and sends the chosen one', async () => {
    const { callsTo } = routes();
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);

    await user.click(await screen.findByRole('button', { name: 'New token' }));
    expect(await screen.findByLabelText('Expires after')).toHaveTextContent('90 days');
    await user.type(screen.getByLabelText('Token name'), 'CI laptop');
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    expect(callsTo('POST', '/users/me/tokens')[0].body).toEqual({ name: 'CI laptop', expiresInDays: 90 });
  });

  it('keeps the one-time token out of storage, the URL, the caches and the console', async () => {
    routes();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<AiAccessCard />);

    await createToken(user);
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain('ejad_pat_');
    expect(document.cookie).not.toContain('ejad_pat_');
    const caches = JSON.stringify([
      queryClient.getQueryCache().getAll().map((q) => q.state.data),
      queryClient.getMutationCache().getAll().map((m) => m.state.data),
    ]);
    expect(caches).not.toContain(TOKEN);
    for (const spy of [log, info, warn, error, debug]) {
      expect(spy.mock.calls.flat().join(' ')).not.toContain(TOKEN);
    }
    log.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
    debug.mockRestore();
  });

  it('tells the tester to copy by hand when the clipboard refuses, and keeps the token on screen', async () => {
    routes();
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);
    await createToken(user);
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('NotAllowedError'));
    await user.click(screen.getByRole('button', { name: 'Copy token' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not copy. Select the text and copy it by hand.'));
    expect(screen.getByText(TOKEN)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  });

  it('forgets the token on Done and cannot bring it back', async () => {
    routes();
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);
    await createToken(user);
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByText(TOKEN)).not.toBeInTheDocument());
    // The snippets fall back to the placeholder rather than replaying the token.
    // Three snippets carry it (command + two JSON blocks), so this is getAllByText.
    expect(screen.getAllByText(/Bearer YOUR_TOKEN/)).toHaveLength(3);
  });

  it('keeps the token-reveal status region announcement-only, with no buttons inside it', async () => {
    routes();
    const user = userEvent.setup();
    renderWithClient(<AiAccessCard />);

    await createToken(user);
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(`${'Amina laptop'} is ready`);
    // The live region must wrap only the announced text. A screen reader re-announcing this region on
    // every render must not also re-announce interactive controls like Copy token/Done.
    expect(within(status).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Copy token' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('builds the setup snippets from the real API URL', async () => {
    routes();
    renderWithClient(<AiAccessCard />);

    expect(await screen.findByText(/claude mcp add --transport http ejad-tests http:\/\/localhost:3000\/api\/mcp/)).toBeInTheDocument();
    // Claude Desktop and Cursor share the same JSON block.
    expect(screen.getAllByText(/"url": "http:\/\/localhost:3000\/api\/mcp"/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy config' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Cursor config' })).toBeInTheDocument();
  });
});
