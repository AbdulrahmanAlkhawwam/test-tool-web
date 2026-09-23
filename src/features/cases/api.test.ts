import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, json, mockRoutes } from '@/test/fetch-routes';
import { caseItem, pagedCases, suggestion } from '@/test/fixtures';
import { createWrapper } from '@/test/render';
import {
  caseKeys,
  useAcceptSuggestion,
  useApproveCase,
  useApproveCases,
  useCases,
  useDraftCount,
  useRejectSuggestion,
  useSuggestion,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('review hooks', () => {
  it('counts the AI drafts with one one-item page', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/test-cases': pagedCases([], { total: 2, pageSize: 1 }) });
    const { result } = renderHook(() => useDraftCount('p1'), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(callsTo('GET', '/projects/p1/test-cases')[0].query).toEqual({ reviewState: 'AI_DRAFT', page: '1', pageSize: '1' });
  });

  it('passes the reviewState filter through to the list', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/test-cases': pagedCases([caseItem('c1', 'TC-AUTH-001', { reviewState: 'AI_DRAFT' })]) });
    const { result } = renderHook(() => useCases('p1', { reviewState: 'AI_DRAFT', page: 1, pageSize: 50 }), {
      wrapper: createWrapper().wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callsTo('GET', '/projects/p1/test-cases')[0].query).toEqual({ reviewState: 'AI_DRAFT', page: '1', pageSize: '50' });
  });

  it('approves one draft and refreshes the lists and counts', async () => {
    const { callsTo } = mockRoutes({ 'POST /test-cases/c1/approve': caseItem('c1', 'TC-AUTH-001') });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useApproveCase('p1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('c1');
    });
    expect(callsTo('POST', '/test-cases/c1/approve')[0].body).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: caseKeys.all('p1') });
  });

  it('refreshes after a stale approve so the row stops offering Approve', async () => {
    mockRoutes({ 'POST /test-cases/c1/approve': () => apiError(404, 'Test case not found') });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useApproveCase('p1'), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('c1')).rejects.toMatchObject({ message: 'Test case not found' });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: caseKeys.all('p1') });
  });

  it('bulk approves with an ids body', async () => {
    const body = { approved: ['c1'], failed: [{ id: 'c2', message: 'Already approved' }] };
    const { callsTo } = mockRoutes({ 'POST /test-cases/approve': body });
    const { result } = renderHook(() => useApproveCases('p1'), { wrapper: createWrapper().wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(['c1', 'c2'])).resolves.toEqual(body);
    });
    expect(callsTo('POST', '/test-cases/approve')[0].body).toEqual({ ids: ['c1', 'c2'] });
  });

  it('reads the pending suggestion, tolerates no-suggestion answers, and reports a stale accept', async () => {
    mockRoutes({
      'GET /test-cases/c1/suggestion': () => json(200, null),
      'POST /suggestions/s1/accept': () => apiError(409, 'The test case changed since this suggestion – review it again'),
      'POST /suggestions/s1/reject': () => new Response(null, { status: 204 }),
    });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ read: useSuggestion('c1'), accept: useAcceptSuggestion('p1'), reject: useRejectSuggestion('p1') }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.read.isSuccess).toBe(true));
    expect(result.current.read.data).toBeNull();

    await act(async () => {
      await expect(result.current.accept.mutateAsync(suggestion().id)).rejects.toMatchObject({
        status: 409,
        message: 'The test case changed since this suggestion – review it again',
      });
    });
    // A 409 means the case moved on: refresh it and its suggestion so the panel redraws.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case'] });

    await act(async () => {
      await result.current.reject.mutateAsync('s1');
    });
  });
});
