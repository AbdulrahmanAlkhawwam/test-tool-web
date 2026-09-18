import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveOptions {
  delayMs?: number;
  retryDelayMs?: number;
}

/**
 * Collects field changes and saves them: text after `delayMs` of quiet, anything immediately on request.
 * Saves run one at a time. A failed save keeps its fields and waits for retry(); a failure that may be
 * transient (network error, 5xx) is first retried once automatically. A rejection (4xx) is not, since
 * sending the same patch again would fail the same way — `error` carries it so the reason can be shown.
 */
export function useAutoSave<P extends object>(save: (patch: Partial<P>) => Promise<unknown>, { delayMs = 800, retryDelayMs = 1500 }: AutoSaveOptions = {}) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<unknown>(null);
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
      setError(null);

      const attempt = (async () => {
        try {
          await saveRef.current(patch);
          inFlightPatch.current = {};
          if (!Object.keys(pending.current).length) setState('saved');
        } catch (e) {
          // Newer edits made while saving win over the failed patch.
          pending.current = { ...patch, ...pending.current };
          inFlightPatch.current = {};
          setError(e);
          setState('error');
          if (autoRetry && isTransient(e)) {
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

  return { state, error, queue, flush, retry, isDirty };
}

/** Network errors and server errors may succeed on retry; a 4xx means the server rejected the change. */
export function isTransient(error: unknown): boolean {
  return !(error instanceof ApiError && error.status < 500);
}
