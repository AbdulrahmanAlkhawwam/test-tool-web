import { formatDateTime, formatRelative } from '@/lib/format';
import type { ApiToken } from '@/lib/types';

export type TokenState = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export const TOKEN_STATE_LABELS: Record<TokenState, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

/** Revoked beats expired: a revoked token is dead however far away its expiry is (spec §4). */
export function tokenState(token: ApiToken, now: Date = new Date()): TokenState {
  if (token.revokedAt) return 'REVOKED';
  return new Date(token.expiresAt).getTime() <= now.getTime() ? 'EXPIRED' : 'ACTIVE';
}

/**
 * What the "Expires" cell shows. The label is always an absolute date in the reader's own time zone,
 * so two testers in different zones never disagree about when a token dies; the relative form ("in 3
 * months") is a hint on the cell, never the only thing shown.
 */
export function expiryText(token: ApiToken, now: Date = new Date()): { label: string; hint: string } {
  const state = tokenState(token, now);
  if (state === 'REVOKED') return { label: `Revoked ${formatDateTime(token.revokedAt)}`, hint: '' };
  return {
    label: formatDateTime(token.expiresAt),
    hint: state === 'EXPIRED' ? 'Expired' : `Expires ${formatRelative(token.expiresAt)}`,
  };
}

/** `lastUsedAt` is updated at most once a minute (spec §4), so a relative time is honest enough here. */
export function lastUsedText(token: ApiToken): string {
  return token.lastUsedAt ? formatRelative(token.lastUsedAt) : 'Never used';
}
