import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api, ApiError } from '@/lib/api';
import type { ResultStatus, RunDetail, RunListItem, RunResult, RunSelection, TestRun } from '@/lib/types';
import { needsPipelinePolling, PIPELINE_POLL_MS } from './pipeline';
import { summarizeResults } from './summary';

export const runKeys = {
  list: (projectId: string) => ['runs', projectId] as const,
  detail: (runId: string) => ['run', runId] as const,
};

export function useRuns(projectId: string) {
  return useQuery({
    queryKey: runKeys.list(projectId),
    queryFn: () => api<RunListItem[]>(`/projects/${projectId}/runs`),
    enabled: !!projectId,
    // Automated runs change on GitLab's side. Refresh while any pipeline is still running (spec §7).
    refetchInterval: (query) => (query.state.data?.some(needsPipelinePolling) ? PIPELINE_POLL_MS : false),
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => api<RunDetail>(`/runs/${runId}`),
    refetchInterval: (query) => (needsPipelinePolling(query.state.data) ? PIPELINE_POLL_MS : false),
  });
}

function useInvalidateRuns(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) }),
      queryClient.invalidateQueries({ queryKey: ['run'] }),
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: ['reports', projectId] }),
    ]);
}

export interface CreateRunInput {
  name: string;
  build?: string;
  environment?: string;
  selection: RunSelection;
}

export function useCreateRun(projectId: string) {
  const invalidate = useInvalidateRuns(projectId);
  return useMutation({
    mutationFn: (input: CreateRunInput) => api<TestRun>(`/projects/${projectId}/runs`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export interface UpdateRunInput {
  name?: string;
  build?: string;
  environment?: string;
  status?: 'COMPLETED';
}

export function useUpdateRun(projectId: string) {
  const invalidate = useInvalidateRuns(projectId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRunInput }) => api<TestRun>(`/runs/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export type ResultPatch = { status?: ResultStatus; actualResult?: string; notes?: string };

/** Saves one result and writes it into the cached run, so an open run page never refetches over typing. */
export function useUpdateResult(runId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, patch }: { resultId: string; patch: ResultPatch }) =>
      api<RunResult>(`/runs/${runId}/results/${resultId}`, { method: 'PATCH', body: patch }),
    // An in-flight GET for this run (e.g. a stale focus refetch) must not resolve after this PATCH
    // and overwrite the fresh cache write below with older values.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: runKeys.detail(runId) });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<RunDetail>(runKeys.detail(runId), (old) => {
        if (!old) return old;
        const results = old.results.map((r) => (r.id === saved.id ? { ...r, ...saved, testCase: r.testCase } : r));
        return { ...old, results, summary: summarizeResults(results) };
      });
      // The run list and reports summarize this run's results too, so they still need a refetch.
      // Project/dashboard counts don't change per result and already refetch on mount/focus.
      void queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['reports', projectId] });
    },
    // 409: the run was completed meanwhile (e.g. by another tester). Refetch it so the page turns
    // read-only; the row keeps the rejected text because that field is still dirty (spec §8).
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) void queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) });
    },
  });
}
