import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { mockRoutes, type MockCall } from '@/test/fetch-routes';
import { branchList, linkedProject, mainBranch, mergeRequest, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AutomationView } from './automation-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const trees: Record<string, AutomationTreeEntry[]> = {
  main: [{ path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' }],
  'tests/amina-login-fixes': [
    { path: 'e2e/auth', name: 'auth', type: 'tree' },
    { path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' },
    { path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' },
  ],
};
const treeRoute = ({ query }: MockCall) => treeAt(query.ref, trees[query.ref] ?? []);

describe('AutomationView', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the user's work branch with its merge request and files", async () => {
    const { callsTo } = mockRoutes({
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
});
