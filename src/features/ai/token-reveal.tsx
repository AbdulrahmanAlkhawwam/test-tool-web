'use client';

import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from './copy-button';

/**
 * The one-time token display (spec §4). The value lives in the parent's state and in this markup —
 * nowhere else. "Done" throws it away for good.
 */
export function TokenReveal({ name, token, onDismiss }: { name: string; token: string; onDismiss: () => void }) {
  return (
    <div role="status" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <KeyRound className="h-4 w-4" aria-hidden />
        {name} is ready
      </p>
      <p className="text-sm text-foreground">
        Copy it into your AI client now. <strong className="font-medium">You will not see this token again</strong> — if you lose it,
        revoke it and create another one.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">{token}</code>
        <CopyButton text={token} label="Copy token" />
      </div>
      <Button variant="outline" size="sm" onClick={onDismiss}>
        Done
      </Button>
    </div>
  );
}
