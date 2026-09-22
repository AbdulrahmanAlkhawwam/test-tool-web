import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiToken, CreatedToken, CreateTokenInput } from '@/lib/types';

export const tokenKeys = {
  all: ['ai-tokens'] as const,
};

/** Spec §9: GET /users/me/tokens — always the signed-in user's own tokens. */
export function useTokens() {
  return useQuery({ queryKey: tokenKeys.all, queryFn: () => api<ApiToken[]>('/users/me/tokens') });
}

/**
 * Spec §4, §9: POST /users/me/tokens. The full `ejad_pat_…` value comes back once, in this mutation's
 * result. Callers copy it into component state and call `reset()` immediately; it is never written to a
 * query cache, storage, the URL or a log.
 */
export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTokenInput) => api<CreatedToken>('/users/me/tokens', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokenKeys.all }),
  });
}

/** Spec §9: DELETE /users/me/tokens/:id. */
export function useRevokeToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/users/me/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokenKeys.all }),
  });
}
