import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { apiToken } from '@/test/fixtures';
import { createWrapper } from '@/test/render';
import { tokenKeys, useCreateToken, useRevokeToken, useTokens } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI access token hooks', () => {
  it('lists the signed-in user’s own tokens', async () => {
    const tokens = [apiToken()];
    const { callsTo } = mockRoutes({ 'GET /users/me/tokens': tokens });
    const { result } = renderHook(() => useTokens(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(tokens);
    expect(callsTo('GET', '/users/me/tokens')).toHaveLength(1);
  });

  it('creates a token with a name and an expiry, and refreshes the list', async () => {
    const created = { ...apiToken(), token: 'ejad_pat_0123456789abcdef0123456789abcdef' };
    const { callsTo } = mockRoutes({ 'POST /users/me/tokens': created });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateToken(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'Amina laptop', expiresInDays: 90 })).resolves.toEqual(created);
    });
    expect(callsTo('POST', '/users/me/tokens')[0].body).toEqual({ name: 'Amina laptop', expiresInDays: 90 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tokenKeys.all });
  });

  it('never leaves the full token in the query cache', async () => {
    const token = 'ejad_pat_0123456789abcdef0123456789abcdef';
    mockRoutes({ 'POST /users/me/tokens': { ...apiToken(), token }, 'GET /users/me/tokens': [apiToken()] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateToken(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Amina laptop', expiresInDays: 90 });
    });
    const cached = JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data));
    expect(cached).not.toContain(token);
  });

  it('revokes a token and surfaces the API’s message when that fails', async () => {
    const { callsTo } = mockRoutes({ 'DELETE /users/me/tokens/t1': () => apiError(404, 'Token not found') });
    const { result } = renderHook(() => useRevokeToken(), { wrapper: createWrapper().wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('t1')).rejects.toMatchObject({ message: 'Token not found' });
    });
    expect(callsTo('DELETE', '/users/me/tokens/t1')).toHaveLength(1);
  });
});
