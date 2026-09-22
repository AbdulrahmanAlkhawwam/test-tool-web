import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageReport } from '@/lib/types';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { CoverageSection } from './coverage-section';

const report: CoverageReport = {
  ref: 'main',
  commitId: 'abc123',
  files: [
    {
      path: 'e2e/auth/login.spec.ts',
      cases: [
        { id: 'c1', code: 'TC-AUTH-001', name: 'Login with email' },
        { id: 'c2', code: 'TC-AUTH-002', name: 'Logout' },
      ],
      unknownCodes: ['TC-AUTH-999'],
    },
    { path: 'e2e/home.spec.ts', cases: [], unknownCodes: [] },
  ],
  notAutomated: [{ id: 'c3', code: 'TC-AUTH-003', name: 'Reset password', module: { code: 'AUTH', name: 'Authentication' } }],
};

describe('CoverageSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows how many cases are automated and which files cover them', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/automation/coverage': report });
    const onOpenFile = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={onOpenFile} />);

    expect(await screen.findByText(/2 of 3 test cases automated \(67%\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TC-AUTH-001' })).toHaveAttribute('href', '/projects/NINJA/cases/c1');
    expect(screen.getByText('TC-AUTH-999')).toHaveAttribute('title', 'No test case has this code, so its results come back Unlinked');
    expect(screen.queryByRole('button', { name: 'e2e/home.spec.ts' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'e2e/auth/login.spec.ts' }));
    expect(onOpenFile).toHaveBeenCalledWith('e2e/auth/login.spec.ts');
    expect(callsTo('GET', '/projects/p1/automation/coverage')[0].query).toEqual({ ref: 'main' });
  });

  it('lists files skipped for being over 1 MB', async () => {
    mockRoutes({ 'GET /projects/p1/automation/coverage': { ...report, skippedFiles: ['e2e/fixtures/huge-data.spec.ts'] } });
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={vi.fn()} />);

    expect(await screen.findByText(/Not scanned \(over 1 MB\)/)).toBeInTheDocument();
    expect(screen.getByText(/e2e\/fixtures\/huge-data\.spec\.ts/)).toBeInTheDocument();
  });

  it('shows no "not scanned" note when nothing was skipped', async () => {
    mockRoutes({ 'GET /projects/p1/automation/coverage': report });
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={vi.fn()} />);

    await screen.findByText(/2 of 3 test cases automated/);
    expect(screen.queryByText(/Not scanned/)).not.toBeInTheDocument();
  });

  it('lists the cases no test is tagged with yet', async () => {
    mockRoutes({ 'GET /projects/p1/automation/coverage': report });
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Not automated yet (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TC-AUTH-003' })).toHaveAttribute('href', '/projects/NINJA/cases/c3');
    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });
});
