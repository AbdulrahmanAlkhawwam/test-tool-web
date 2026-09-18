import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveOptions {
  delayMs?: number;
  retryDelayMs?: number;
}

/**
 * Collects field changes and saves them: text after `delayMs` of quiet, anything immediately on request.
 * Saves run one at a time. A failed save keeps its fields, retries once automatically, then waits for retry().
 */
export function useAutoSave<P extends object>(save: (patch: Partial<P>) => Promise<unknown>, { delayMs = 800, retryDelayMs = 1500 }: AutoSaveOptions = {}) {
  const [state, setState] = useState<SaveState>('idle');
  const pending = useRef<Partial<P>>({});
  // Fields belonging to the patch currently being sent to `save`; pending is cleared before the
  // request goes out, so isDirty needs this to know a field is still unconfirmed mid-request.
  const inFlightPatch = useRef<Partial<P>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flushInternal = useCallback(
    async (autoRetry: boolean): Promise<void> => {
      clearTimeout(timer.current);
      if (inFlight.current) await inFlight.current;
      const patch = pending.current;
      if (!Object.keys(patch).length) return;
      pending.current = {};
      inFlightPatch.current = patch;
      setState('saving');

      const attempt = (async () => {
        try {
          await saveRef.current(patch);
          inFlightPatch.current = {};
          if (!Object.keys(pending.current).length) setState('saved');
        } catch {
          // Newer edits made while saving win over the failed patch.
          pending.current = { ...patch, ...pending.current };
          inFlightPatch.current = {};
          setState('error');
          if (autoRetry) {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => void flushInternal(false), retryDelayMs);
          }
        }
      })();
      inFlight.current = attempt;
      await attempt;
      inFlight.current = null;
    },
    [retryDelayMs],
  );

  const flush = useCallback(() => flushInternal(true), [flushInternal]);
  const retry = useCallback(() => flushInternal(false), [flushInternal]);

  const queue = useCallback(
    (patch: Partial<P>, { immediate = false }: { immediate?: boolean } = {}) => {
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  // True while `field` has an edit that isn't confirmed saved yet: queued, in flight, or failed
  // (a failed field is folded back into `pending`). Callers use this to avoid overwriting a field
  // with a server value that is stale relative to what the user is still trying to save.
  const isDirty = useCallback((field: keyof P) => field in pending.current || field in inFlightPatch.current, []);

  // Leaving the page must not lose typed text.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  return { state, queue, flush, retry, isDirty };
}
