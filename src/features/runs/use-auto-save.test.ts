import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './use-auto-save';

type Patch = { status: string; actualResult: string; notes: string };

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces text changes and saves the latest value once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave<Patch>(save));
    act(() => {
      result.current.queue({ actualResult: 'Opens' });
      result.current.queue({ actualResult: 'Opens a new tab' });
    });
    await act(() => vi.advanceTimersByTimeAsync(799));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ actualResult: 'Opens a new tab' });
    expect(result.current.state).toBe('saved');
  });

  it('saves immediately when asked and merges pending text into the same request', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave<Patch>(save));
    await act(async () => {
      result.current.queue({ actualResult: 'Error not shown' });
      result.current.queue({ status: 'FAILED' }, { immediate: true });
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ actualResult: 'Error not shown', status: 'FAILED' });
  });

  it('flush() saves pending changes right away (blur) and is a no-op when nothing is pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave<Patch>(save));
    await act(() => result.current.flush());
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.queue({ notes: 'Chrome only' }));
    await act(() => result.current.flush());
    expect(save).toHaveBeenCalledWith({ notes: 'Chrome only' });
  });

  it('keeps changes on failure, retries once automatically, then waits for a manual retry', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAutoSave<Patch>(save, { retryDelayMs: 1500 }));

    await act(async () => result.current.queue({ status: 'PASSED' }, { immediate: true }));
    expect(result.current.state).toBe('error');
    expect(save).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ status: 'PASSED' });

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(save).toHaveBeenCalledTimes(2); // no more automatic retries
    expect(result.current.state).toBe('error');

    save.mockResolvedValueOnce(undefined);
    await act(() => result.current.retry());
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith({ status: 'PASSED' });
    expect(result.current.state).toBe('saved');
  });

  it('flushes pending changes when the row unmounts', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutoSave<Patch>(save));
    act(() => result.current.queue({ notes: 'unsent' }));
    unmount();
    expect(save).toHaveBeenCalledWith({ notes: 'unsent' });
  });
});
