'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // The initial render is always `status === 'loading'` (before any client-only state update), and
  // this href is only ever used once `status` has moved to `unauthenticated`, so reading window here
  // can't cause a hydration mismatch — same reasoning as `reloginHref` below.
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const loginHref = `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(loginHref);
  }, [status, router, loginHref]);

  // `expired` only ever happens in the browser, so reading window here can't break hydration (and
  // avoids useSearchParams, which would force a Suspense boundary around every app page).
  const reloginHref =
    status === 'expired' ? `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}` : loginHref;

  if (status !== 'authenticated' && status !== 'expired') return <LoadingState label="Checking your session…" />;
  return (
    <div className="min-h-screen bg-muted/30">
      {status === 'expired' && (
        // The page stays mounted underneath so nothing typed is lost (spec §8); the user can still
        // copy unsaved text before signing in again.
        <div role="alert" className="sticky top-0 z-40 border-b border-destructive/30 bg-destructive/10 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
            <p className="font-medium text-destructive">Your session expired – sign in again.</p>
            <p className="text-muted-foreground">Changes can&apos;t be saved until you do.</p>
            {/* A full page load (not client navigation) so the unsaved-changes warning still fires. */}
            <Button asChild size="sm" className="ml-auto">
              <a href={reloginHref}>Sign in again</a>
            </Button>
          </div>
        </div>
      )}
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
