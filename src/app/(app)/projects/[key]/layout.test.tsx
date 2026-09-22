import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
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
});
