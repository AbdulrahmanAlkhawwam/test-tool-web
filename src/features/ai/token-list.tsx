'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { ApiToken } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useRevokeToken, useTokens } from './api';
import { expiryText, lastUsedText, TOKEN_STATE_LABELS, tokenState, type TokenState } from './tokens';

const STATE_CLASS: Record<TokenState, string> = {
  ACTIVE: 'bg-status-passed/15 text-status-passed-fg',
  EXPIRED: 'bg-status-skipped/15 text-status-skipped-fg',
  REVOKED: 'bg-status-failed/15 text-status-failed-fg',
};

function StateChip({ state }: { state: TokenState }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', STATE_CLASS[state])}>
      {TOKEN_STATE_LABELS[state]}
    </span>
  );
}

/** The tester's own tokens (spec §8): name, prefix, created, last used, expires, Revoke. */
export function TokenList() {
  const tokens = useTokens();
  const revoke = useRevokeToken();
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success(`${revoking.name} revoked`);
      setRevoking(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not revoke the token');
      setRevoking(null);
    }
  }

  if (tokens.isPending) return <LoadingState />;
  if (tokens.isError) return <ErrorState error={tokens.error} onRetry={() => tokens.refetch()} />;
  if (!tokens.data.length) {
    return (
      <EmptyState
        title="No AI tokens yet"
        description="Create one to connect Claude Code, Claude Desktop or Cursor to this tool."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-28">Token</TableHead>
              <TableHead className="w-44">Created</TableHead>
              <TableHead className="w-40">Last used</TableHead>
              <TableHead className="w-48">Expires</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.data.map((token) => {
              const state = tokenState(token);
              const expiry = expiryText(token);
              return (
                <TableRow key={token.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{token.name}</span>
                      <StateChip state={state} />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{token.prefix}…</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(token.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lastUsedText(token)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" title={expiry.hint || undefined}>
                    {expiry.label}
                  </TableCell>
                  <TableCell>
                    {state === 'ACTIVE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Revoke ${token.name}`}
                        onClick={() => setRevoking(token)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke ${revoking?.name}?`}
        description="Any AI client using this token stops working immediately. Drafts it already wrote stay where they are."
        confirmLabel="Revoke"
        destructive
        pending={revoke.isPending}
        onConfirm={() => void confirmRevoke()}
      />
    </>
  );
}
