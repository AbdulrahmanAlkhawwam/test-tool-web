import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectKeys } from '@/features/projects/api';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { linkedProject } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import ProjectLayout from './layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/projects/NINJA/cases' }));

describe('ProjectLayout GitLab visibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the Automation tab and the repository header link when GitLab is disabled on this server', async () => {
    mockRoutes({ 'GET /projects/NINJA': linkedProject, 'GET /gitlab/status': { enabled: false, connection: null } });
    renderWithClient(
      <ProjectLayout params={{ key: 'NINJA' }}>
        <div>children</div>
      </ProjectLayout>,
    );

    expect(await screen.findByRole('link', { name: 'Test Cases' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Automation' })).not.toBeInTheDocument();
    expect(screen.queryByText(linkedProject.gitlabPath as string)).not.toBeInTheDocument();
  });

  it('shows the Automation tab and the repository header link when GitLab is enabled and the project is linked', async () => {
    mockRoutes({
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
    });
    renderWithClient(
      <ProjectLayout params={{ key: 'NINJA' }}>
        <div>children</div>
      </ProjectLayout>,
    );

    expect(await screen.findByRole('link', { name: 'Automation' })).toHaveAttribute('href', '/projects/NINJA/automation');
    expect(screen.getByText(linkedProject.gitlabPath as string)).toBeInTheDocument();
  });

  it('keeps the layout (and its children) mounted when a background project refetch fails', async () => {
    let fail = false;
    mockRoutes({
      'GET /projects/NINJA': () => (fail ? apiError(500, 'Boom') : linkedProject),
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
    });
    const { queryClient } = renderWithClient(
      <ProjectLayout params={{ key: 'NINJA' }}>
        <textarea aria-label="Draft" defaultValue="unsaved text" />
      </ProjectLayout>,
    );
    expect(await screen.findByText(linkedProject.name)).toBeInTheDocument();

    fail = true;
    await act(() => queryClient.refetchQueries({ queryKey: projectKeys.detail('NINJA') }));

    expect(await screen.findByText(/Couldn.t refresh this project/)).toBeInTheDocument();
    expect(screen.getByText(linkedProject.name)).toBeInTheDocument();
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved text');
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });

  it('shows the "Project not found" page (not the layout) when the project never loaded', async () => {
    mockRoutes({ 'GET /projects/NINJA': apiError(404, 'Project not found') });
    renderWithClient(
      <ProjectLayout params={{ key: 'NINJA' }}>
        <div>children</div>
      </ProjectLayout>,
    );

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();
  });
});
