'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

/** `expired`: the user was signed in, but the session could not be renewed and they must sign in again. */
export type AuthStatus = 'loading' | 'authenticated' | 'expired' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isAdmin: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  // Who's signed in, kept even across a sign-out/expiry so the next login can tell whether it's the
  // same person renewing their session or someone else on the same browser.
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      // Deliberately NOT queryClient.clear() here. AppLayout keeps the current page mounted while
      // `expired` (spec: unsaved text is never discarded), but every query still mounted on it (e.g.
      // the Automation tab's branches/tree/file) would be reset to pending the moment its cache entry
      // is removed — which unmounts that page's content just as surely as swapping in an error state
      // would. The cache is cleared instead on an explicit logout, and on the next login if it's for a
      // different user than before.
      setStatus((prev) => (prev === 'authenticated' || prev === 'expired' ? 'expired' : 'unauthenticated'));
    });
    refreshSession()
      .then((u) => {
        previousUserId.current = u.id;
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => setStatus('unauthenticated'));
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ accessToken: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      // A different person signing in on this browser must not see the previous person's cached data
      // (projects, runs, …). Signing back in as the same person (e.g. after "Sign in again" on expiry)
      // is not that case, so their still-mounted page's queries are left alone.
      if (previousUserId.current !== null && previousUserId.current !== data.user.id) {
        queryClient.clear();
      }
      previousUserId.current = data.user.id;
      setAccessToken(data.accessToken);
      setUser(data.user);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear();
      previousUserId.current = null;
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, isAdmin: user?.role === 'ADMIN', login, logout }),
    [status, user, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
