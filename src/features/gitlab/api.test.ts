import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockRoutes } from '@/test/fetch-routes';
import { fileAt, mergeRequest } from '@/test/fixtures';
import { createWrapper } from '@/test/render';
import {
  automationKeys,
  gitlabKeys,
  useAutomationBranches,
  useAutomationFile,
  useCiSnippet,
  useCreateCaseFromResult,
  useGitlabProjects,
  useGitlabStatus,
  useLinkRepository,
  useRunAutomated,
  useSaveAutomationFile,
  useStartGitlabConnect,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitLab API hooks', () => {
  it('reads the GitLab status', async () => {
    const status = { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } };
    const { callsTo } = mockRoutes({ 'GET /gitlab/status': status });
    const { result } = renderHook(() => useGitlabStatus(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(status);
    expect(callsTo('GET', '/gitlab/status')).toHaveLength(1);
  });

  it('treats a 404 status endpoint as GitLab disabled', async () => {
    mockRoutes({});
    const { result } = renderHook(() => useGitlabStatus(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ enabled: false, connection: null });
  });

  it('starts the OAuth flow and returns the GitLab authorize URL', async () => {
    mockRoutes({ 'GET /gitlab/oauth/start': { authorizeUrl: 'https://git.ejad.net/oauth/authorize?client_id=x' } });
    const { result } = renderHook(() => useStartGitlabConnect(), { wrapper: createWrapper().wrapper });
    let url = '';
    await act(async () => {
      url = (await result.current.mutateAsync()).authorizeUrl;
    });
    expect(url).toBe('https://git.ejad.net/oauth/authorize?client_id=x');
  });

  it('searches GitLab projects only once two characters are typed', async () => {
    const { callsTo } = mockRoutes({ 'GET /gitlab/projects': [] });
    const { result, rerender } = renderHook(({ search }: { search: string }) => useGitlabProjects(search), {
      wrapper: createWrapper().wrapper,
      initialProps: { search: 'n' },
    });
    expect(result.current.fetchStatus).toBe('idle');
    rerender({ search: 'ni ' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callsTo('GET', '/gitlab/projects').map((c) => c.query)).toEqual([{ search: 'ni' }]);
  });

  it('links a repository with PUT and refreshes the project', async () => {
    const { callsTo } = mockRoutes({ 'PUT /projects/p1/repository': {} });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useLinkRepository('p1'), { wrapper });
    const input = { gitlabProjectId: 42, defaultBranch: 'main', testsPath: 'e2e', playwrightConfigPath: 'playwright.config.ts' };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(callsTo('PUT', '/projects/p1/repository')[0].body).toEqual(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });

  it('refreshes the GitLab status when the API says the connection must be renewed', async () => {
    mockRoutes({
      'GET /projects/p1/automation/branches': () =>
        json(403, { statusCode: 403, error: 'Forbidden', message: 'Reconnect GitLab', details: { code: 'GITLAB_NEEDS_RECONNECT' } }),
    });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAutomationBranches('p1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: gitlabKeys.status });
  });

  it('reads a file at a ref', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/automation/file': fileAt('main', 'x', 'c1') });
    const { result } = renderHook(() => useAutomationFile('p1', 'main', 'e2e/login.spec.ts'), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lastCommitId).toBe('c1');
    expect(callsTo('GET', '/projects/p1/automation/file')[0].query).toEqual({ ref: 'main', path: 'e2e/login.spec.ts' });
  });

  it('saves a file to the work branch and caches the saved version there', async () => {
    const saved = { branch: 'tests/amina-login-fixes', commitId: 'c2', mergeRequest };
    const { callsTo } = mockRoutes({ 'PUT /projects/p1/automation/file': saved });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveAutomationFile('p1'), { wrapper });
    const input = { path: 'e2e/login.spec.ts', content: 'test()', lastCommitId: 'c1', branchSlug: 'login-fixes' };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toEqual(saved);
    });
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toEqual(input);
    expect(queryClient.getQueryData(automationKeys.file('p1', 'tests/amina-login-fixes', 'e2e/login.spec.ts'))).toEqual({
      path: 'e2e/login.spec.ts',
      ref: 'tests/amina-login-fixes',
      content: 'test()',
      lastCommitId: 'c2',
      size: 6,
      readOnly: false,
    });
  });

  it('starts an automated run with a branch and scope', async () => {
    const { callsTo } = mockRoutes({ 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const { result } = renderHook(() => useRunAutomated('p1'), { wrapper: createWrapper().wrapper });
    const input = { branch: 'main', scope: { mode: 'CASES' as const, caseIds: ['c1'] } };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toEqual({ id: 'run9' });
    });
    expect(callsTo('POST', '/projects/p1/runs/automated')[0].body).toEqual(input);
  });

  it('returns the YAML of the CI snippet', async () => {
    const yaml = 'ejad-playwright:\n  image: mcr.microsoft.com/playwright:v1.47.0-jammy\n';
    mockRoutes({ 'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml } });
    const { result } = renderHook(() => useCiSnippet('p1'), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.data).toBe(yaml));
  });

  it('creates a test case from an unlinked result', async () => {
    const created = { testCase: { id: 'c9', code: 'TC-CHK-001' }, resultId: 'r1', tag: '@TC-CHK-001' };
    const { callsTo } = mockRoutes({ 'POST /runs/run1/results/r1/create-case': created });
    const { result } = renderHook(() => useCreateCaseFromResult('run1', 'p1'), { wrapper: createWrapper().wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ resultId: 'r1', input: { name: 'Pay with card', moduleId: 'm2' } })).resolves.toEqual(created);
    });
    expect(callsTo('POST', '/runs/run1/results/r1/create-case')[0].body).toEqual({ name: 'Pay with card', moduleId: 'm2' });
  });
});
