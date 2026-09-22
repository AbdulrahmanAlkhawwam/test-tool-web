import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gitlabKeys } from '@/features/gitlab/api';
import type { AutomationTreeEntry } from '@/lib/types';
import { apiError, mockRoutes, type MockCall } from '@/test/fetch-routes';
import { fileAt, linkedProject, mainBranch, treeAt, unlinkedProject, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import AutomationPage from './page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/features/automation/code-editor', () => import('@/test/code-editor-mock'));

const ACTIVE = { enabled: true, connection: { username: 'amina', state: 'ACTIVE' as const } };
const NEEDS_RECONNECT = { enabled: true, connection: { username: 'amina', state: 'NEEDS_RECONNECT' as const } };

const trees: Record<string, AutomationTreeEntry[]> = {
  'tests/amina/login-fixes': [{ path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' }],
};
const treeRoute = ({ query }: MockCall) => treeAt(query.ref, trees[query.ref] ?? []);
const panelRoutes = {
  'GET /projects/p1/automation/coverage': { ref: 'tests/amina/login-fixes', commitId: 'abc', files: [], notAutomated: [] },
  'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml: 'ejad-playwright:\n' },
};

async function openDirtyEditor() {
  const user = userEvent.setup();
  // A generous timeout: this chain runs project → GitLab status → branches → tree through several
  // sequential mocked fetches, which can take longer than the default 1s under a loaded test run.
  await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }, { timeout: 10000 }));
  const editor = await screen.findByLabelText('Code editor');
  fireEvent.change(editor, { target: { value: 'dirty edit' } });
  return editor;
}

describe('AutomationPage draft safety', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the automation view (and unsaved text) mounted when a background GitLab-status refetch fails', async () => {
    let fail = false;
    mockRoutes({
      ...panelRoutes,
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': () => (fail ? apiError(500, 'Boom') : ACTIVE),
      'GET /projects/p1/automation/branches': { defaultBranch: 'main', branches: [mainBranch, workBranch] },
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const { queryClient } = renderWithClient(<AutomationPage params={{ key: 'NINJA' }} />);

    await openDirtyEditor();

    fail = true;
    await act(() => queryClient.refetchQueries({ queryKey: gitlabKeys.status }));

    expect(await screen.findByText(/Couldn.t refresh GitLab status/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
    expect(screen.getByLabelText('Branch')).toBeInTheDocument();
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });

  it('shows a reconnect banner above the still-mounted view instead of replacing it', async () => {
    let needsReconnect = false;
    mockRoutes({
      ...panelRoutes,
      'GET /projects/NINJA': linkedProject,
      'GET /gitlab/status': () => (needsReconnect ? NEEDS_RECONNECT : ACTIVE),
      'GET /projects/p1/automation/branches': { defaultBranch: 'main', branches: [mainBranch, workBranch] },
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const { queryClient } = renderWithClient(<AutomationPage params={{ key: 'NINJA' }} />);

    await openDirtyEditor();

    needsReconnect = true;
    await act(() => queryClient.refetchQueries({ queryKey: gitlabKeys.status }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/GitLab sign-in expired or was revoked/);
    expect(screen.getByRole('link', { name: 'Reconnect on Profile' })).toHaveAttribute('href', '/profile');
    // The view stays mounted: the dirty editor text and the rest of the automation UI are still there.
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
    expect(screen.getByLabelText('Branch')).toBeInTheDocument();
    // The full-page "Reconnect GitLab" empty state never replaces the view: its action link isn't there.
    expect(screen.queryByRole('link', { name: 'Reconnect GitLab' })).not.toBeInTheDocument();
  });

  it('shows the full reconnect state (no automation view yet) on first entry', async () => {
    mockRoutes({ 'GET /projects/NINJA': linkedProject, 'GET /gitlab/status': NEEDS_RECONNECT });
    renderWithClient(<AutomationPage params={{ key: 'NINJA' }} />);

    expect(await screen.findByRole('link', { name: 'Reconnect GitLab' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByLabelText('Branch')).not.toBeInTheDocument();
  });

  it("says automation isn't set up on this server when GitLab is disabled, opened directly", async () => {
    mockRoutes({ 'GET /projects/NINJA': linkedProject, 'GET /gitlab/status': { enabled: false, connection: null } });
    renderWithClient(<AutomationPage params={{ key: 'NINJA' }} />);

    expect(await screen.findByText("GitLab automation isn't set up on this server")).toBeInTheDocument();
    expect(screen.queryByText(/Settings → Repository/)).not.toBeInTheDocument();
  });

  it('still points to Settings → Repository when GitLab is enabled but this project has no linked repository', async () => {
    mockRoutes({ 'GET /projects/NINJA': unlinkedProject, 'GET /gitlab/status': ACTIVE });
    renderWithClient(<AutomationPage params={{ key: 'NINJA' }} />);

    expect(await screen.findByText("Automation isn't set up for this project")).toBeInTheDocument();
    expect(screen.getByText(/Settings → Repository/)).toBeInTheDocument();
  });
});
