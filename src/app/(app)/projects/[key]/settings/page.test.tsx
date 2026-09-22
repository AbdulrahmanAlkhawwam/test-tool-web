import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { linkedProject } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import SettingsPage from './page';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ isAdmin: false }) }));

describe('SettingsPage (non-admin)', () => {
  it('hides Settings → Repository from a non-admin, even when GitLab is enabled and the project is linked', async () => {
    mockRoutes({
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } },
    });
    renderWithClient(<SettingsPage params={{ key: 'NINJA' }} />);

    expect(await screen.findByText(/Only admins can change project settings/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Repository' })).not.toBeInTheDocument();
  });
});
