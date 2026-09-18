import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Dashboard, ProjectDetail, ProjectListItem } from '@/lib/types';

export const projectKeys = {
  all: ['projects'] as const,
  list: (includeArchived: boolean) => ['projects', 'list', includeArchived] as const,
  detail: (key: string) => ['projects', 'detail', key.toUpperCase()] as const,
  dashboard: ['dashboard'] as const,
};

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: projectKeys.list(includeArchived),
    queryFn: () => api<ProjectListItem[]>('/projects', { query: { includeArchived: includeArchived ? 'true' : undefined } }),
  });
}

export function useProject(key: string) {
  return useQuery({
    queryKey: projectKeys.detail(key),
    queryFn: () => api<ProjectDetail>(`/projects/${encodeURIComponent(key)}`),
  });
}

export function useDashboard() {
  return useQuery({ queryKey: projectKeys.dashboard, queryFn: () => api<Dashboard>('/dashboard') });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
    ]);
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api<ProjectDetail>('/projects', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  archived?: boolean;
}

export function useUpdateProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => api<ProjectDetail>(`/projects/${projectId}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}
