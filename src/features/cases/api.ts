import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api } from '@/lib/api';
import type { ModuleRef, ModuleSummary, Paged, Priority, ResultStatus, TestCase, TestCaseDetail, TestCaseListItem } from '@/lib/types';
import type { CaseInput } from './case-schema';

export interface CaseFilters {
  moduleId?: string;
  priority?: Priority;
  status?: ResultStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export const caseKeys = {
  all: (projectId: string) => ['cases', projectId] as const,
  list: (projectId: string, filters: CaseFilters) => ['cases', projectId, 'list', filters] as const,
  detail: (id: string) => ['case', id] as const,
  modules: (projectId: string) => ['modules', projectId] as const,
};

export function useCases(projectId: string, filters: CaseFilters) {
  return useQuery({
    queryKey: caseKeys.list(projectId, filters),
    queryFn: () => api<Paged<TestCaseListItem>>(`/projects/${projectId}/test-cases`, { query: { ...filters } }),
    placeholderData: keepPreviousData,
  });
}

export function useCase(id: string) {
  return useQuery({ queryKey: caseKeys.detail(id), queryFn: () => api<TestCaseDetail>(`/test-cases/${id}`) });
}

/** Everything that shows case lists, counts or module counts for a project. */
function useInvalidateCases(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: caseKeys.all(projectId) }),
      queryClient.invalidateQueries({ queryKey: ['case'] }),
      queryClient.invalidateQueries({ queryKey: caseKeys.modules(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
    ]);
}

export function useCreateCase(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: (input: CaseInput) => api<TestCase>(`/projects/${projectId}/test-cases`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateCase(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CaseInput> }) =>
      api<TestCase>(`/test-cases/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCase(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/test-cases/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useModules(projectId: string) {
  return useQuery({
    queryKey: caseKeys.modules(projectId),
    queryFn: () => api<ModuleSummary[]>(`/projects/${projectId}/modules`),
    enabled: !!projectId,
  });
}

export interface ModuleInput {
  name: string;
  code: string;
}

export function useCreateModule(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: (input: ModuleInput) => api<ModuleRef>(`/projects/${projectId}/modules`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateModule(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ModuleInput> }) =>
      api<ModuleRef>(`/modules/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteModule(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/modules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
