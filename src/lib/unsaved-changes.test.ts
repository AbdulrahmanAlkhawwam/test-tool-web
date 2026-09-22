import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setUnsavedChanges, useUnsavedChanges } from './unsaved-changes';

describe('unsaved-changes store', () => {
  it('starts false and reflects setUnsavedChanges across renders', () => {
    setUnsavedChanges(false);
    const { result } = renderHook(() => useUnsavedChanges());
    expect(result.current).toBe(false);

    act(() => setUnsavedChanges(true));
    expect(result.current).toBe(true);

    act(() => setUnsavedChanges(false));
    expect(result.current).toBe(false);
  });

  it('notifies multiple subscribers', () => {
    setUnsavedChanges(false);
    const a = renderHook(() => useUnsavedChanges());
    const b = renderHook(() => useUnsavedChanges());

    act(() => setUnsavedChanges(true));
    expect(a.result.current).toBe(true);
    expect(b.result.current).toBe(true);
  });
});
