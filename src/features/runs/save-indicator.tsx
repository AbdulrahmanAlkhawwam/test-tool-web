import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { SaveState } from './use-auto-save';

/** Why the server rejected a save (4xx), or null when the failure may be transient. */
function rejectionReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status >= 500) return null;
  if (error.status === 401) return 'Session expired – sign in again';
  return error.details.length ? error.details.join('; ') : error.message;
}

export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error?: unknown; onRetry: () => void }) {
  if (state === 'saving') return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (state === 'saved') return <span className="text-xs text-status-passed-fg">Saved ✓</span>;
  if (state === 'error') {
    const reason = rejectionReason(error);
    if (reason)
      return (
        <span className="text-xs text-destructive">
          Not saved: {reason}
          <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-xs text-destructive" onClick={onRetry}>
            Retry
          </Button>
        </span>
      );
    return (
      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={onRetry}>
        Not saved – retry
      </Button>
    );
  }
  return null;
}
