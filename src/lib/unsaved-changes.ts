import { useSyncExternalStore } from 'react';

/**
 * Whether some part of the app currently has unsaved changes (right now, just the Automation editor).
 * A tiny module-level store instead of React context: the Automation editor and the app header that
 * needs to know about it live under different, unrelated layouts, so lifting this through context would
 * mean wrapping the whole (app) layout just for one boolean. Logging out while this is true must ask for
 * confirmation instead of silently discarding the draft (spec: unsaved changes are never silently lost).
 */
let hasUnsavedChanges = false;
const listeners = new Set<() => void>();

export function setUnsavedChanges(value: boolean): void {
  if (hasUnsavedChanges === value) return;
  hasUnsavedChanges = value;
  listeners.forEach((listener) => listener());
}

function getSnapshot(): boolean {
  return hasUnsavedChanges;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while `setUnsavedChanges(true)` was called more recently than `setUnsavedChanges(false)`. */
export function useUnsavedChanges(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
