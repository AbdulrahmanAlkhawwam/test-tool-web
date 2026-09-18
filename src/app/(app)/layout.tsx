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
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(loginHref);
  }, [status, router, loginHref]);

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
              <a href={loginHref}>Sign in again</a>
            </Button>
          </div>
        </div>
      )}
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
