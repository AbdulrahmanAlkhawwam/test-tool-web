'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Unplug } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { goTo } from '@/lib/navigate';
import { gitlabKeys, useDisconnectGitlab, useGitlabStatus, useStartGitlabConnect } from './api';

/** Friendly text for each /gitlab/callback failure reason (spec §4, §10). Anything unrecognized falls to the last case. */
function connectErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'invalid_state':
      return 'The GitLab sign-in link expired or was already used. Try connecting again.';
    case 'denied':
      return 'GitLab access was not granted.';
    case 'already_linked':
      return 'That GitLab account is already linked to another Ejad user.';
    default:
      return "Couldn't finish connecting GitLab. Try again.";
  }
}

/** Profile → GitLab (spec §4, §10). Must render inside <Suspense> because it reads the search params. */
export function GitlabCard() {
  const status = useGitlabStatus();
  const start = useStartGitlabConnect();
  const disconnect = useDisconnectGitlab();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const searchParams = useSearchParams();
  const outcome = searchParams.get('gitlab');
  const reason = searchParams.get('reason');
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  // /gitlab/callback redirects to /profile?gitlab=connected or ?gitlab=error&reason=…. Confirm it once,
  // refresh the status and drop only those two params, keeping any others the URL already carried.
  useEffect(() => {
    if (!outcome || handled.current) return;
    handled.current = true;
    if (outcome === 'connected') toast.success('GitLab connected');
    else toast.error(connectErrorMessage(reason));
    void queryClient.invalidateQueries({ queryKey: gitlabKeys.status });
    const rest = new URLSearchParams(searchParams);
    rest.delete('gitlab');
    rest.delete('reason');
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [outcome, reason, queryClient, router, pathname, searchParams]);

  async function connect() {
    try {
      const { authorizeUrl } = await start.mutateAsync();
      goTo(authorizeUrl);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not start the GitLab connection');
    }
  }

  async function confirmDisconnect() {
    try {
      await disconnect.mutateAsync();
      toast.success('GitLab disconnected');
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not disconnect GitLab');
    }
  }

  if (!status.data?.enabled) return null;
  const connection = status.data.connection;
  const needsReconnect = connection?.state === 'NEEDS_RECONNECT';

  return (
    <section aria-labelledby="gitlab-heading" className="rounded-xl border bg-card p-5">
      <h2 id="gitlab-heading" className="font-medium">
        GitLab
      </h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-muted-foreground">
        Connect your company GitLab account to view, edit and run a project&apos;s automated tests. Everything the tool does in
        GitLab for you uses your own account and permissions.
      </p>
      {!connection ? (
        <Button onClick={() => void connect()} disabled={start.isPending}>
          {start.isPending ? 'Opening GitLab…' : 'Connect GitLab'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {connection.avatarUrl ? (
              // The avatar comes from the GitLab host, so next/image would need its domain configured.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={connection.avatarUrl} alt="" className="h-9 w-9 rounded-full border" />
            ) : (
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-medium">
                {connection.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-medium">@{connection.username}</p>
              <p className="text-xs text-muted-foreground">{needsReconnect ? 'Needs reconnect' : 'Connected'}</p>
            </div>
          </div>
          {needsReconnect && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Your GitLab sign-in expired or was revoked. Reconnect to keep using automation.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {needsReconnect && (
              <Button onClick={() => void connect()} disabled={start.isPending}>
                <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
                Reconnect GitLab
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <Unplug className="mr-1.5 h-4 w-4" aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect GitLab?"
        description="The tool stops using your GitLab account. Your work branches and merge requests stay in GitLab."
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={() => void confirmDisconnect()}
      />
    </section>
  );
}
