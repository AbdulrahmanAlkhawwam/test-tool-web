import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { branchList, linkedProject, mainBranch, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { RunTestsDialog } from './run-tests-dialog';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const routes = {
  'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
  'GET /projects/p1/automation/tree': treeAt('main', [{ path: 'e2e/auth', name: 'auth', type: 'tree' }]),
};

describe('RunTestsDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts a pipeline for a folder on the chosen branch and opens the run', async () => {
    const { callsTo } = mockRoutes({ ...routes, 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await screen.findByRole('option', { name: /tests\/amina\/login-fixes/ });
    await user.selectOptions(screen.getByLabelText('Branch'), 'tests/amina/login-fixes');
    await user.click(screen.getByLabelText('A folder or file'));
    const path = screen.getByLabelText('Folder or file');
    await user.clear(path);
    await user.type(path, 'e2e/auth/');
    await user.click(screen.getByRole('button', { name: 'Start pipeline' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/NINJA/runs/run9'));
    expect(callsTo('POST', '/projects/p1/runs/automated')[0].body).toEqual({
      branch: 'tests/amina/login-fixes',
      scope: { mode: 'PATH', path: 'e2e/auth' },
    });
  });

  it('warns, confirms, and stays on the page (offering a link to the run) while the editor has unsaved changes', async () => {
    const { callsTo } = mockRoutes({ ...routes, 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} dirty />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The pipeline runs the code committed on the branch');
    expect(screen.getByRole('alert')).toHaveTextContent("they'll stay right here in the editor");
    await user.click(screen.getByRole('button', { name: 'Start pipeline' }));

    expect(callsTo('POST', '/projects/p1/runs/automated')).toHaveLength(0);
    const confirmDialog = await screen.findByRole('alertdialog');
    expect(confirmDialog).toHaveTextContent('runs the code already committed on the branch');
    expect(confirmDialog).toHaveTextContent("Your changes stay in the editor and won't be lost");

    await user.click(within(confirmDialog).getByRole('button', { name: 'Start pipeline' }));
    await waitFor(() => expect(callsTo('POST', '/projects/p1/runs/automated')).toHaveLength(1));

    // Starting the pipeline while dirty never navigates away: the draft would be lost with it.
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      'Pipeline started',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Open run' }) }),
    );

    // The toast's action still gets the user to the run when they're ready for it.
    const [, options] = vi.mocked(toast.success).mock.calls[0];
    const action = (options as unknown as { action: { onClick: (e?: unknown) => void } }).action;
    action.onClick();
    expect(push).toHaveBeenCalledWith('/projects/NINJA/runs/run9');
  });

  it('does not warn when the editor has no unsaved changes', async () => {
    mockRoutes({ ...routes, 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('blocks a path outside the tests folder', async () => {
    mockRoutes(routes);
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await user.click(screen.getByLabelText('A folder or file'));
    const path = screen.getByLabelText('Folder or file');
    await user.clear(path);
    await user.type(path, 'src/app');

    expect(screen.getByText('Choose a folder or file inside e2e')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pipeline' })).toBeDisabled();
  });
});
