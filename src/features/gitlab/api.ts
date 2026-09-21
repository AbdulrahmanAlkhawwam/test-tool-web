import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { caseKeys } from '@/features/cases/api';
import { projectKeys } from '@/features/projects/api';
import { runKeys } from '@/features/runs/api';
import { api, ApiError } from '@/lib/api';
import type {
  AutomatedRunInput,
  AutomationBranches,
  AutomationFile,
  AutomationTree,
  CiSnippetResponse,
  CoverageReport,
  CreateCaseFromResultInput,
  CreateCaseFromResultResponse,
  GitlabOauthCompleteInput,
  GitlabOauthCompleteResult,
  GitlabProjectOption,
  GitlabStatus,
  RepositoryInput,
  RepositoryLink,
  RunDetail,
  SaveFileInput,
  SaveFileResult,
} from '@/lib/types';
import { byteLength } from './paths';

export const gitlabKeys = {
  status: ['gitlab', 'status'] as const,
  projects: (search: string) => ['gitlab', 'projects', search] as const,
};

export const automationKeys = {
  all: (projectId: string) => ['automation', projectId] as const,
  branches: (projectId: string) => ['automation', projectId, 'branches'] as const,
  trees: (projectId: string) => ['automation', projectId, 'tree'] as const,
  tree: (projectId: string, ref: string) => ['automation', projectId, 'tree', ref] as const,
  file: (projectId: string, ref: string, path: string) => ['automation', projectId, 'file', ref, path] as const,
  coverages: (projectId: string) => ['automation', projectId, 'coverage'] as const,
  coverage: (projectId: string, ref: string) => ['automation', projectId, 'coverage', ref] as const,
  ciSnippet: (projectId: string) => ['automation', projectId, 'ci-snippet'] as const,
};

const DISABLED: GitlabStatus = { enabled: false, connection: null };

/** The API answers 403 with details.code GITLAB_NOT_CONNECTED / GITLAB_NEEDS_RECONNECT when the user's GitLab connection is gone. */
export function isConnectionError(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 403) return false;
  const code = (e.body.details as { code?: unknown } | undefined)?.code;
  return code === 'GITLAB_NOT_CONNECTED' || code === 'GITLAB_NEEDS_RECONNECT';
}

/** Refetches the GitLab status after a connection error, so the UI switches to "Connect/Reconnect GitLab" (spec §4). */
function useRefreshStatusOnConnectionError() {
  const queryClient = useQueryClient();
  return (e: unknown) => {
    if (isConnectionError(e)) void queryClient.invalidateQueries({ queryKey: gitlabKeys.status });
  };
}

export function useGitlabStatus() {
  return useQuery({
    queryKey: gitlabKeys.status,
    queryFn: async () => {
      try {
        return await api<GitlabStatus>('/gitlab/status');
      } catch (e) {
        // Without GITLAB_URL the API hides its GitLab endpoints (spec §3): same as "disabled".
        if (e instanceof ApiError && e.status === 404) return DISABLED;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useStartGitlabConnect() {
  return useMutation({ mutationFn: () => api<{ authorizeUrl: string }>('/gitlab/oauth/start') });
}

/** POST /gitlab/oauth/complete, called once by /gitlab/callback with GitLab's redirect params (spec §4, §10). */
export function useCompleteGitlabConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GitlabOauthCompleteInput) =>
      api<GitlabOauthCompleteResult>('/gitlab/oauth/complete', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gitlabKeys.status }),
  });
}

export function useDisconnectGitlab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/gitlab/connection', { method: 'DELETE' }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['automation'] });
      await queryClient.invalidateQueries({ queryKey: ['gitlab'] });
    },
  });
}

/** Admin search for linking (GET /gitlab/projects?search=). Waits for at least two characters. */
export function useGitlabProjects(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: gitlabKeys.projects(term),
    queryFn: () => api<GitlabProjectOption[]>('/gitlab/projects', { query: { search: term } }),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
}

function useInvalidateRepository(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: automationKeys.all(projectId) }),
    ]);
}

export function useLinkRepository(projectId: string) {
  const invalidate = useInvalidateRepository(projectId);
  return useMutation({
    mutationFn: (input: RepositoryInput) => api<RepositoryLink>(`/projects/${projectId}/repository`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  });
}

export function useUnlinkRepository(projectId: string) {
  const invalidate = useInvalidateRepository(projectId);
  return useMutation({
    mutationFn: () => api<void>(`/projects/${projectId}/repository`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useAutomationBranches(projectId: string, enabled = true) {
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useQuery({
    queryKey: automationKeys.branches(projectId),
    // The Automation tab's first request: if the GitLab connection is gone, it notices here.
    queryFn: async () => {
      try {
        return await api<AutomationBranches>(`/projects/${projectId}/automation/branches`);
      } catch (e) {
        onConnectionError(e);
        throw e;
      }
    },
    enabled: enabled && !!projectId,
  });
}

export function useAutomationTree(projectId: string, ref: string) {
  return useQuery({
    queryKey: automationKeys.tree(projectId, ref),
    queryFn: () => api<AutomationTree>(`/projects/${projectId}/automation/tree`, { query: { ref } }),
    enabled: !!projectId && !!ref,
  });
}

export function useAutomationFile(projectId: string, ref: string, path: string | null) {
  return useQuery({
    queryKey: automationKeys.file(projectId, ref, path ?? ''),
    queryFn: () => api<AutomationFile>(`/projects/${projectId}/automation/file`, { query: { ref, path } }),
    enabled: !!projectId && !!ref && !!path,
    // The editor keeps its own copy while the user types. Refetch on request (Reload), not on window focus.
    refetchOnWindowFocus: false,
  });
}

/** Commits one file to the user's work branch and opens/updates its merge request (spec §6). */
export function useSaveAutomationFile(projectId: string) {
  const queryClient = useQueryClient();
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useMutation({
    mutationFn: (input: SaveFileInput) =>
      api<SaveFileResult>(`/projects/${projectId}/automation/file`, { method: 'PUT', body: input }),
    onError: onConnectionError,
    onSuccess: (result, input) => {
      // The saved text is now this file's content on the work branch. Seed it so opening it there needs no fetch.
      queryClient.setQueryData<AutomationFile>(automationKeys.file(projectId, result.branch, input.path), {
        path: input.path,
        ref: result.branch,
        content: input.content,
        lastCommitId: result.commitId,
        size: byteLength(input.content),
        readOnly: false,
      });
      void queryClient.invalidateQueries({ queryKey: automationKeys.branches(projectId) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.tree(projectId, result.branch) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.coverages(projectId) });
    },
  });
}

export function useCoverage(projectId: string, ref: string) {
  return useQuery({
    queryKey: automationKeys.coverage(projectId, ref),
    queryFn: () => api<CoverageReport>(`/projects/${projectId}/automation/coverage`, { query: { ref } }),
    enabled: !!projectId && !!ref,
  });
}

/** The provided CI job (spec §7) for this project's Playwright config. The data is the YAML text. */
export function useCiSnippet(projectId: string) {
  return useQuery({
    queryKey: automationKeys.ciSnippet(projectId),
    queryFn: () => api<CiSnippetResponse>(`/projects/${projectId}/automation/ci-snippet`),
    select: (data) => data.yaml,
    enabled: !!projectId,
    staleTime: Infinity,
  });
}

/** Creates an AUTOMATED run and triggers its GitLab pipeline as the current user (spec §7). */
export function useRunAutomated(projectId: string) {
  const queryClient = useQueryClient();
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useMutation({
    mutationFn: (input: AutomatedRunInput) => api<RunDetail>(`/projects/${projectId}/runs/automated`, { method: 'POST', body: input }),
    onError: onConnectionError,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
      ]),
  });
}

/** Turns an Unlinked automated result into a new test case (spec §7). */
export function useCreateCaseFromResult(runId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, input }: { resultId: string; input: CreateCaseFromResultInput }) =>
      api<CreateCaseFromResultResponse>(`/runs/${runId}/results/${resultId}/create-case`, { method: 'POST', body: input }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) }),
        queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) }),
        queryClient.invalidateQueries({ queryKey: caseKeys.all(projectId) }),
        queryClient.invalidateQueries({ queryKey: caseKeys.modules(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: automationKeys.coverages(projectId) }),
      ]),
  });
}
