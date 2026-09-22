import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { linkedProject, unlinkedProject } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import RunsPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe('RunsPage "Run tests" visibility', () => {
  it('hides "Run tests" when GitLab automation is disabled on this server', async () => {
    mockRoutes({
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': { enabled: false, connection: null },
      'GET /projects/p1/runs': [],
    });
    renderWithClient(<RunsPage params={{ key: 'NINJA' }} />);

    await waitFor(() => expect(screen.getByText('No runs yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Run tests' })).not.toBeInTheDocument();
  });

  it('hides "Run tests" when the project has no linked repository', async () => {
    mockRoutes({
      'GET /projects/NINJA': unlinkedProject,
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
      'GET /projects/p1/runs': [],
    });
    renderWithClient(<RunsPage params={{ key: 'NINJA' }} />);

    await waitFor(() => expect(screen.getByText('No runs yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Run tests' })).not.toBeInTheDocument();
  });

  it('hides "Run tests" while the connection needs reconnecting', async () => {
    mockRoutes({
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'NEEDS_RECONNECT' } },
      'GET /projects/p1/runs': [],
    });
    renderWithClient(<RunsPage params={{ key: 'NINJA' }} />);

    await waitFor(() => expect(screen.getByText('No runs yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Run tests' })).not.toBeInTheDocument();
  });

  it('shows "Run tests" once GitLab automation is ready', async () => {
    mockRoutes({
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
      'GET /projects/p1/runs': [],
    });
    renderWithClient(<RunsPage params={{ key: 'NINJA' }} />);

    expect(await screen.findByRole('button', { name: 'Run tests' })).toBeInTheDocument();
  });
});
