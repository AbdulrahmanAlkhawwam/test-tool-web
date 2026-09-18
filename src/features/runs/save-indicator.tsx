import { Button } from '@/components/ui/button';
import type { SaveState } from './use-auto-save';

export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'saving') return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (state === 'saved') return <span className="text-xs text-status-passed-fg">Saved ✓</span>;
  if (state === 'error')
    return (
      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={onRetry}>
        Not saved – retry
      </Button>
    );
  return null;
}
