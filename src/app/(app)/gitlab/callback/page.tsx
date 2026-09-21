'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { LoadingState } from '@/components/page-state';
import { useCompleteGitlabConnect } from '@/features/gitlab/api';
import { ApiError } from '@/lib/api';
import type { GitlabOauthFailureReason } from '@/lib/types';

/** `details.reason` from the API, or `exchange_failed` for anything else (a network error, a bad body, …). */
function failureReason(e: unknown): GitlabOauthFailureReason | string {
  if (e instanceof ApiError) {
    const reason = (e.body.details as { reason?: unknown } | undefined)?.reason;
    if (typeof reason === 'string') return reason;
  }
  return 'exchange_failed';
}

function GitlabCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const complete = useCompleteGitlabConnect();
  // GitLab's state is single-use: a second POST (e.g. React StrictMode's double effect in dev) would fail.
  const sent = useRef(false);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    if (!state) {
      router.replace('/profile?gitlab=error&reason=invalid_state');
      return;
    }

    complete.mutate(
      { state, code: code ?? undefined, error: error ?? undefined },
      {
        onSuccess: () => router.replace('/profile?gitlab=connected'),
        onError: (e) => router.replace(`/profile?gitlab=error&reason=${encodeURIComponent(failureReason(e))}`),
      },
    );
    // complete.mutate is re-created every render; the ref guard above keeps this a one-shot regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state, error, router]);

  return <LoadingState label="Connecting GitLab…" />;
}

/** GitLab redirects here (not to the API) with `?code=&state=` or `?error=&state=` (spec §4, §10). */
export default function GitlabCallbackPage() {
  return (
    <Suspense fallback={<LoadingState label="Connecting GitLab…" />}>
      <GitlabCallback />
    </Suspense>
  );
}
