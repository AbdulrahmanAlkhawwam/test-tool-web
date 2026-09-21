import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { mockRoutes, type MockCall } from '@/test/fetch-routes';
import { branchList, fileAt, linkedProject, mainBranch, mergeRequest, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AutomationView } from './automation-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./code-editor', () => import('@/test/code-editor-mock'));

const trees: Record<string, AutomationTreeEntry[]> = {
  main: [{ path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' }],
  'tests/amina-login-fixes': [
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
    expect(screen.getByLabelText('Branch')).toHaveValue('tests/amina-login-fixes');
    expect(screen.getByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(callsTo('GET', '/projects/p1/automation/tree').map((c) => c.query.ref)).toEqual(['tests/amina-login-fixes']);
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

  it('re-expands the top-level folders when returning to a previously visited (cached) branch', async () => {
    const localTrees: Record<string, AutomationTreeEntry[]> = {
      'tests/amina-login-fixes': [
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
});
