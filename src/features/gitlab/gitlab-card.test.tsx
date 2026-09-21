import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goTo } from '@/lib/navigate';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { GitlabCard } from './gitlab-card';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/profile',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/navigate', () => ({ goTo: vi.fn() }));

describe('GitlabCard', () => {
  beforeEach(() => {
    nav.search = '';
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders nothing when GitLab is disabled', async () => {
    const { callsTo } = mockRoutes({ 'GET /gitlab/status': { enabled: false, connection: null } });
    const { container } = renderWithClient(<GitlabCard />);
    await waitFor(() => expect(callsTo('GET', '/gitlab/status')).toHaveLength(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('heading', { name: 'GitLab' })).not.toBeInTheDocument();
  });

  it('sends the user to GitLab to connect', async () => {
    mockRoutes({
      'GET /gitlab/status': { enabled: true, connection: null },
      'GET /gitlab/oauth/start': { authorizeUrl: 'https://git.ejad.net/oauth/authorize?state=s1' },
    });
    const user = userEvent.setup();
    renderWithClient(<GitlabCard />);
    await user.click(await screen.findByRole('button', { name: 'Connect GitLab' }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('https://git.ejad.net/oauth/authorize?state=s1'));
  });

  it('asks to reconnect when the connection needs it', async () => {
    mockRoutes({
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'NEEDS_RECONNECT', avatarUrl: null } },
    });
    renderWithClient(<GitlabCard />);
    expect(await screen.findByText('@amina')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reconnect to keep using automation');
    expect(screen.getByRole('button', { name: 'Reconnect GitLab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('confirms a finished connection and clears the query string', async () => {
    nav.search = 'gitlab=connected';
    mockRoutes({ 'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } } });
    renderWithClient(<GitlabCard />);
    expect(await screen.findByText('@amina')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('GitLab connected');
    expect(nav.replace).toHaveBeenCalledWith('/profile');
  });
});
