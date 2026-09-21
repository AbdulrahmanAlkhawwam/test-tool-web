import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { linkedProject, unlinkedProject } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { RepositorySettings } from './repository-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const active = { enabled: true, connection: { username: 'admin', state: 'ACTIVE' } };

describe('RepositorySettings', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('searches GitLab and links the chosen project with its tests folder', async () => {
    const { callsTo } = mockRoutes({
      'GET /gitlab/status': active,
      'GET /gitlab/projects': [
        {
          id: 42,
          name: 'Ninja Store',
          pathWithNamespace: 'mobile/ninja-store',
          webUrl: 'https://git.ejad.net/mobile/ninja-store',
          defaultBranch: 'develop',
        },
      ],
      'PUT /projects/p1/repository': {},
    });
    const user = userEvent.setup();
    renderWithClient(<RepositorySettings project={unlinkedProject} />);

    await user.type(await screen.findByLabelText('GitLab project'), 'ninja');
    await user.click(await screen.findByRole('button', { name: /mobile\/ninja-store/ }));
    expect(screen.getByLabelText('Default branch')).toHaveValue('develop');
    await user.type(screen.getByLabelText('Tests folder'), '/e2e/');
    await user.click(screen.getByRole('button', { name: 'Link repository' }));

    await waitFor(() => expect(callsTo('PUT', '/projects/p1/repository')).toHaveLength(1));
    expect(callsTo('PUT', '/projects/p1/repository')[0].body).toEqual({
      gitlabProjectId: 42,
      defaultBranch: 'develop',
      testsPath: 'e2e',
      playwrightConfigPath: 'playwright.config.ts',
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Repository linked'));
  });

  it('asks the admin to connect GitLab before searching', async () => {
    mockRoutes({ 'GET /gitlab/status': { enabled: true, connection: null } });
    renderWithClient(<RepositorySettings project={unlinkedProject} />);
    expect(await screen.findByText(/Connect your GitLab account to search repositories/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByLabelText('GitLab project')).not.toBeInTheDocument();
  });

  it('unlinks a linked repository after confirming', async () => {
    const { callsTo } = mockRoutes({
      'GET /gitlab/status': active,
      'DELETE /projects/p1/repository': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    renderWithClient(<RepositorySettings project={linkedProject} />);

    expect(await screen.findByRole('link', { name: /mobile\/ninja-store/ })).toHaveAttribute('href', 'https://git.ejad.net/mobile/ninja-store');
    await user.click(screen.getByRole('button', { name: 'Unlink repository' }));
    await user.click(await screen.findByRole('button', { name: 'Unlink' }));

    await waitFor(() => expect(callsTo('DELETE', '/projects/p1/repository')).toHaveLength(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Repository unlinked'));
  });
});
