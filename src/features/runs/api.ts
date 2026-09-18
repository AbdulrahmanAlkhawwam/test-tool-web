import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';
import type { RunDetail, RunListItem, RunSelection, TestRun } from '@/lib/types';

export const runKeys = {
  list: (projectId: string) => ['runs', projectId] as const,
  detail: (runId: string) => ['run', runId] as const,
};

export function useRuns(projectId: string) {
  return useQuery({
    queryKey: runKeys.list(projectId),
    queryFn: () => api<RunListItem[]>(`/projects/${projectId}/runs`),
    enabled: !!projectId,
  });
}

export function useRun(runId: string) {
  return useQuery({ queryKey: runKeys.detail(runId), queryFn: () => api<RunDetail>(`/runs/${runId}`) });
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
