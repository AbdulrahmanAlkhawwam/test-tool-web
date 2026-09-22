import { describe, expect, it } from 'vitest';
import { apiToken } from '@/test/fixtures';
import { expiryText, lastUsedText, TOKEN_STATE_LABELS, tokenState } from './tokens';

const now = new Date('2026-09-22T12:00:00.000Z');

describe('tokenState', () => {
  it('is ACTIVE before the expiry, EXPIRED after it, and REVOKED whatever the expiry says', () => {
    expect(tokenState(apiToken(), now)).toBe('ACTIVE');
    expect(tokenState(apiToken({ expiresAt: '2026-09-22T11:59:00.000Z' }), now)).toBe('EXPIRED');
    expect(tokenState(apiToken({ revokedAt: '2026-09-10T00:00:00.000Z' }), now)).toBe('REVOKED');
    // Revoked wins: a revoked token is dead even though its expiry is still in the future.
    expect(tokenState(apiToken({ revokedAt: '2026-09-10T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z' }), now)).toBe('REVOKED');
    expect(TOKEN_STATE_LABELS).toEqual({ ACTIVE: 'Active', EXPIRED: 'Expired', REVOKED: 'Revoked' });
  });
});

describe('expiryText', () => {
  it('shows the absolute local date, with the relative distance only as a hint', () => {
    const { label, hint } = expiryText(apiToken({ expiresAt: '2026-12-21T09:00:00.000Z' }), now);
    // The label is a real date in the reader's own time zone, not an ISO string and not "in 3 months".
    expect(label).not.toContain('2026-12-21T09:00:00.000Z');
    expect(label).toMatch(/\d{1,2} \w{3} 2026, \d{2}:\d{2}/);
    expect(hint).toBe('Expires in 3 months');
  });

  it('says so when the expiry has passed or the token was revoked', () => {
    expect(expiryText(apiToken({ expiresAt: '2026-08-01T09:00:00.000Z' }), now).hint).toBe('Expired');
    expect(expiryText(apiToken({ revokedAt: '2026-09-10T06:00:00.000Z' }), now).label).toMatch(/^Revoked 10 Sep 2026/);
  });
});

describe('lastUsedText', () => {
  it('names the moment when there is one and says "Never used" otherwise', () => {
    expect(lastUsedText(apiToken({ lastUsedAt: null }))).toBe('Never used');
    expect(lastUsedText(apiToken({ lastUsedAt: '2026-09-22T11:00:00.000Z' }))).not.toBe('Never used');
  });
});
