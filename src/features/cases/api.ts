import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api';
import { api, ApiError } from '@/lib/api';
import type {
  BulkApproveResult,
  ImportPreview,
  ImportResult,
  ModuleRef,
  ModuleSummary,
  Paged,
  Priority,
  ResultStatus,
  ReviewState,
  TestCase,
  TestCaseDetail,
  TestCaseListItem,
  TestCaseSuggestion,
} from '@/lib/types';
import type { CaseInput } from './case-schema';

export interface CaseFilters {
  moduleId?: string;
  priority?: Priority;
  status?: ResultStatus;
  /** Spec §9: the new `reviewState` filter. Absent means "the default list", which includes drafts. */
  reviewState?: ReviewState;
  q?: string;
  page: number;
  pageSize: number;
}

export const caseKeys = {
  all: (projectId: string) => ['cases', projectId] as const,
  list: (projectId: string, filters: CaseFilters) => ['cases', projectId, 'list', filters] as const,
  draftCount: (projectId: string) => ['cases', projectId, 'draft-count'] as const,
  detail: (id: string) => ['case', id] as const,
  suggestion: (caseId: string) => ['case', caseId, 'suggestion'] as const,
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

/** The "AI drafts (N)" chip count (spec §8): one page of one item, read for its `total`. */
export function useDraftCount(projectId: string) {
  return useQuery({
    queryKey: caseKeys.draftCount(projectId),
    queryFn: () =>
      api<Paged<TestCaseListItem>>(`/projects/${projectId}/test-cases`, { query: { reviewState: 'AI_DRAFT', page: 1, pageSize: 1 } }),
    // A `total` the API forgot to send must render as 0, never as NaN or "undefined" in the chip.
    select: (data) => data.total ?? 0,
    enabled: !!projectId,
  });
}

/** 404/409 means the draft was approved or rejected somewhere else: refresh so the UI stops offering it. */
function useRefreshOnStale(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return (e: unknown) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 409)) void invalidate();
  };
}

/** Spec §9: POST /test-cases/:id/approve. */
export function useApproveCase(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  const onStale = useRefreshOnStale(projectId);
  return useMutation({
    mutationFn: (id: string) => api<TestCase>(`/test-cases/${id}/approve`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: onStale,
  });
}

/** Spec §9: POST /test-cases/approve with `{ ids }`. Valid ids are approved even when some fail (spec §6). */
export function useApproveCases(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  const onStale = useRefreshOnStale(projectId);
  return useMutation({
    mutationFn: (ids: string[]) => api<BulkApproveResult>('/test-cases/approve', { method: 'POST', body: { ids } }),
    onSuccess: invalidate,
    onError: onStale,
  });
}

/** Spec §9: GET /test-cases/:id/suggestion — the one pending suggestion, or null. */
export function useSuggestion(caseId: string) {
  return useQuery({
    queryKey: caseKeys.suggestion(caseId),
    // The API answers `null` (or 204) when there is nothing pending; React Query forbids `undefined`.
    queryFn: async () => (await api<TestCaseSuggestion | null>(`/test-cases/${caseId}/suggestion`)) ?? null,
    enabled: !!caseId,
  });
}

/** Spec §9: POST /suggestions/:id/accept — 409 when the case changed since the suggestion (spec §6). */
export function useAcceptSuggestion(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  const onStale = useRefreshOnStale(projectId);
  return useMutation({
    mutationFn: (suggestionId: string) => api<TestCase>(`/suggestions/${suggestionId}/accept`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: onStale,
  });
}

/** Spec §9: POST /suggestions/:id/reject. */
export function useRejectSuggestion(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  return useMutation({
    mutationFn: (suggestionId: string) => api<void>(`/suggestions/${suggestionId}/reject`, { method: 'POST' }),
    onSuccess: invalidate,
  });
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

export function usePreviewImport(projectId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api<ImportPreview>(`/projects/${projectId}/import/preview`, { method: 'POST', body: form });
    },
  });
}

export interface ConfirmImportInput {
  importId: string;
  duplicateStrategy: 'skip' | 'update';
  createImportedRun: boolean;
  runName?: string;
}

export function useConfirmImport(projectId: string) {
  const invalidate = useInvalidateCases(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmImportInput) =>
      api<ImportResult>(`/projects/${projectId}/import/confirm`, { method: 'POST', body: input }),
    onSuccess: () => Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ['runs', projectId] })]),
  });
}
