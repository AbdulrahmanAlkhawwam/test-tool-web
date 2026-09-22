import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { automationKeys } from '@/features/gitlab/api';
import type { AutomationTreeEntry } from '@/lib/types';
import { useUnsavedChanges } from '@/lib/unsaved-changes';
import { apiError, mockRoutes, type MockCall } from '@/test/fetch-routes';
import { branchList, fileAt, linkedProject, mainBranch, mergeRequest, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AutomationView } from './automation-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('./code-editor', () => import('@/test/code-editor-mock'));

const trees: Record<string, AutomationTreeEntry[]> = {
  main: [{ path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' }],
  'tests/amina/login-fixes': [
    { path: 'e2e/auth', name: 'auth', type: 'tree' },
    { path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' },
    { path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' },
  ],
};
const treeRoute = ({ query }: MockCall) => treeAt(query.ref, trees[query.ref] ?? []);

// The coverage and CI panels (Task 5) load too. These tests don't look at them.
const panelRoutes = {
  'GET /projects/p1/automation/coverage': { ref: 'main', commitId: 'abc', files: [], notAutomated: [] },
  'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml: 'ejad-playwright:\n' },
};

describe('AutomationView', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the user's work branch with its merge request and files", async () => {
    const { callsTo } = mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    expect(await screen.findByRole('button', { name: /login\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Branch')).toHaveValue('tests/amina/login-fixes');
    expect(screen.getByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(callsTo('GET', '/projects/p1/automation/tree').map((c) => c.query.ref)).toEqual(['tests/amina/login-fixes']);
  });

  it("shows another branch's files after switching branches", async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await screen.findByRole('button', { name: /login\.spec\.ts/ });
    await user.selectOptions(screen.getByLabelText('Branch'), 'main');

    expect(await screen.findByRole('button', { name: /home\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login\.spec\.ts/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Merge request/ })).not.toBeInTheDocument();
  });

  it('switches to the new work branch after the first save and shows its merge request', async () => {
    let saved = false;
    const { callsTo } = mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': () => (saved ? branchList(mainBranch, workBranch) : branchList(mainBranch)),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': ({ query }: MockCall) =>
        query.ref === workBranch.name ? fileAt(workBranch.name, 'new', 'c2') : fileAt('main', 'old', 'c1'),
      'PUT /projects/p1/automation/file': () => {
        saved = true;
        return { branch: workBranch.name, commitId: 'c2', mergeRequest };
      },
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /home\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    expect(editor).toHaveValue('old');
    fireEvent.change(editor, { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    expect(await screen.findByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    expect(await screen.findByLabelText('Code editor')).toHaveValue('new');
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toMatchObject({ path: 'e2e/home.spec.ts', branchSlug: 'login-fixes' });
  });

  it('switches to the new work branch after a save whose merge request update failed, without crashing', async () => {
    let saved = false;
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': () =>
        saved ? branchList(mainBranch, { ...workBranch, mergeRequest: null }) : branchList(mainBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': ({ query }: MockCall) =>
        query.ref === workBranch.name ? fileAt(workBranch.name, 'new', 'c2') : fileAt('main', 'old', 'c1'),
      'PUT /projects/p1/automation/file': () => {
        saved = true;
        return { branch: workBranch.name, commitId: 'c2', mergeRequest: null };
      },
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /home\.spec\.ts/ }));
    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    expect(await screen.findByLabelText('Code editor')).toHaveValue('new');
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    expect(screen.queryByRole('link', { name: /Merge request/ })).not.toBeInTheDocument();
  });

  it('re-expands the top-level folders when returning to a previously visited (cached) branch', async () => {
    const localTrees: Record<string, AutomationTreeEntry[]> = {
      'tests/amina/login-fixes': [
        { path: 'e2e/auth', name: 'auth', type: 'tree' },
        { path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' },
      ],
      main: [
        { path: 'e2e/smoke', name: 'smoke', type: 'tree' },
        { path: 'e2e/smoke/basic.spec.ts', name: 'basic.spec.ts', type: 'blob' },
      ],
    };
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': ({ query }: MockCall) => treeAt(query.ref, localTrees[query.ref] ?? []),
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    // Opens on amina's work branch (branch A): its top-level "auth" folder is expanded by default.
    expect(await screen.findByRole('button', { name: /login\.spec\.ts/ })).toBeInTheDocument();

    // Switch to main (branch B), whose different top-level folder ("smoke") expands by default too.
    await user.selectOptions(screen.getByLabelText('Branch'), 'main');
    expect(await screen.findByRole('button', { name: /basic\.spec\.ts/ })).toBeInTheDocument();

    // Switch back to the work branch (branch A), now served from cache: its top-level folder must
    // still be expanded by default, not stuck with branch B's leftover expand state.
    await user.selectOptions(screen.getByLabelText('Branch'), workBranch.name);
    expect(await screen.findByRole('button', { name: /login\.spec\.ts/ })).toBeInTheDocument();
  });

  it('confirms before discarding a dirty editor to open a different file, and Cancel keeps it', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': ({ query }: MockCall) =>
        query.path === 'e2e/home.spec.ts'
          ? fileAt(workBranch.name, 'home content', 'c2', { path: 'e2e/home.spec.ts' })
          : fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    expect(editor).toHaveValue('login content');
    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    await user.click(screen.getByRole('button', { name: /home\.spec\.ts/ }));
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
    expect(screen.getByRole('button', { name: /login\.spec\.ts/ })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: /home\.spec\.ts/ }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(await screen.findByLabelText('Code editor')).toHaveValue('home content');
    expect(screen.getByRole('button', { name: /home\.spec\.ts/ })).toHaveAttribute('aria-current', 'true');
  });

  it('confirms before discarding a dirty editor to switch branches', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    await user.selectOptions(screen.getByLabelText('Branch'), 'main');
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');

    await user.selectOptions(screen.getByLabelText('Branch'), 'main');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(screen.getByLabelText('Branch')).toHaveValue('main');
    expect(await screen.findByRole('button', { name: /home\.spec\.ts/ })).toBeInTheDocument();
  });

  it('warns before leaving the page only while the editor is dirty', async () => {
    const user = userEvent.setup();
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it('keeps the editor and its unsaved text mounted when a background branches refetch fails', async () => {
    let fail = false;
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': () => (fail ? apiError(500, 'Boom') : branchList(mainBranch, workBranch)),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const { queryClient } = renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    fail = true;
    await act(() => queryClient.refetchQueries({ queryKey: automationKeys.branches('p1') }));

    expect(await screen.findByText(/Couldn.t refresh branches/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
  });

  it('pins the branch once chosen and warns instead of switching silently when it disappears from the list', async () => {
    let deleted = false;
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': () => (deleted ? branchList(mainBranch) : branchList(mainBranch, workBranch)),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'dirty edit' } });

    // The branch's MR gets merged and GitLab deletes it: the next branches refetch no longer lists it.
    deleted = true;
    await act(() => queryClient.refetchQueries({ queryKey: automationKeys.branches('p1') }));

    expect(await screen.findByText(/This branch no longer exists in GitLab/)).toBeInTheDocument();
    // Never switches silently: the branch selector and the editor (with the unsaved text) stay put.
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');
  });

  it('guards in-app navigation while the editor is dirty: Cancel stays, Confirm navigates', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    renderWithClient(
      <>
        <a href="/elsewhere" onClick={(e) => e.preventDefault()}>
          Elsewhere
        </a>
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'dirty edit' } });

    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Code editor')).toHaveValue('dirty edit');

    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(push).toHaveBeenCalledWith('/elsewhere');
  });

  it('does not intercept an internal link click when the editor has no unsaved changes', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    const user = userEvent.setup();
    renderWithClient(
      <>
        <a href="/elsewhere" onClick={(e) => e.preventDefault()}>
          Elsewhere
        </a>
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </>,
    );

    await screen.findByRole('button', { name: /login\.spec\.ts/ });
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));

    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("doesn't intercept an external link click even while the editor is dirty", async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    renderWithClient(
      <>
        <a href="https://example.com/external" onClick={(e) => e.preventDefault()}>
          External
        </a>
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'dirty edit' } });

    await user.click(screen.getByRole('link', { name: 'External' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not intercept a hash-only same-page link or a download link, even while dirty', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    renderWithClient(
      <>
        <a href="#section">Jump</a>
        <a href="/report.pdf" download onClick={(e) => e.preventDefault()}>
          Download
        </a>
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'dirty edit' } });

    await user.click(screen.getByRole('link', { name: 'Jump' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Download' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not show the branch-missing banner for a failed branches refetch right after a save', async () => {
    let branchesCalls = 0;
    mockRoutes({
      ...panelRoutes,
      // Call 1 is the initial load (before the save, so naturally without the not-yet-created work
      // branch). Call 2 is the refetch the save's onSuccess triggers, and it fails outright.
      'GET /projects/p1/automation/branches': () => {
        branchesCalls++;
        return branchesCalls === 1 ? branchList(mainBranch) : apiError(500, 'Boom');
      },
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': ({ query }: MockCall) =>
        query.ref === workBranch.name ? fileAt(workBranch.name, 'new', 'c2') : fileAt('main', 'old', 'c1'),
      'PUT /projects/p1/automation/file': () => ({ branch: workBranch.name, commitId: 'c2', mergeRequest }),
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /home\.spec\.ts/ }));
    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    expect(await screen.findByLabelText('Code editor')).toHaveValue('new');
    await screen.findByText(/Couldn.t refresh branches/);
    // The refetch after the save failed and the (pre-save) list still lacks the brand-new branch, but
    // that must never be read as "this branch was deleted".
    expect(screen.queryByText(/This branch no longer exists in GitLab/)).not.toBeInTheDocument();
  });

  it('publishes dirty state to the shared unsaved-changes store, and clears it when it unmounts', async () => {
    mockRoutes({
      ...panelRoutes,
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': fileAt(workBranch.name, 'login content', 'c1', { path: 'e2e/auth/login.spec.ts' }),
    });
    const user = userEvent.setup();
    function Probe() {
      return <p data-testid="probe">{useUnsavedChanges() ? 'dirty' : 'clean'}</p>;
    }
    const { rerender } = renderWithClient(
      <>
        <Probe />
        <AutomationView project={linkedProject} repo={repo} username="amina" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: /login\.spec\.ts/ }));
    expect(screen.getByTestId('probe')).toHaveTextContent('clean');

    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'dirty edit' } });
    expect(screen.getByTestId('probe')).toHaveTextContent('dirty');

    rerender(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('clean');
  });
});
