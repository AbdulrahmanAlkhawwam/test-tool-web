'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { AutomationView } from '@/features/automation/automation-view';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';
import type { RepositoryLink } from '@/lib/types';

export default function AutomationPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const gitlab = useGitlabStatus();
  // Sticky: once the Automation view has loaded (repo + username known), keep it mounted even if a
  // later background refresh fails or the connection later needs reconnecting. Swapping it for another
  // state would unmount the editor and lose unsaved text (spec: draft safety is the top priority).
  const readyRef = useRef<{ repo: RepositoryLink; username: string } | null>(null);

  if (!project.data) return null;
  if (gitlab.isPending) return <LoadingState />;
  // Only show the full error state when GitLab status has never loaded. A background refetch failure
  // once we already know the status falls through below instead (small banner, view stays mounted).
  if (gitlab.isError && !gitlab.data) return <ErrorState error={gitlab.error} onRetry={() => gitlab.refetch()} />;

  const access = automationAccess(gitlab.data, project.data);
  if (access.state === 'ready') readyRef.current = { repo: access.repo, username: access.username };
  const ready = readyRef.current;

  if (ready) {
    return (
      <div className="space-y-3">
        {access.state === 'reconnect' && (
          <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Your GitLab sign-in expired or was revoked.
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-status-blocked-fg">
              <Link href="/profile">Reconnect on Profile</Link>
            </Button>
            to keep saving. Your unsaved changes are still here — copy them if you need to.
          </p>
        )}
        {access.state === 'ready' && gitlab.isError && (
          <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
            Couldn&apos;t refresh GitLab status – retrying.
          </p>
        )}
        <AutomationView project={project.data} repo={ready.repo} username={ready.username} />
      </div>
    );
  }

  switch (access.state) {
    case 'hidden':
      return access.reason === 'disabled' ? (
        <EmptyState title="GitLab automation isn't set up on this server" />
      ) : (
        <EmptyState
          title="Automation isn't set up for this project"
          description="An admin can link the project's GitLab repository in Settings → Repository."
        />
      );
    case 'connect':
      return (
        <EmptyState
          title="Connect GitLab to use automation"
          description="Automation uses your own GitLab account, so your GitLab permissions apply."
          action={
            <Button asChild>
              <Link href="/profile">Connect GitLab</Link>
            </Button>
          }
        />
      );
    case 'reconnect':
      return (
        <EmptyState
          title="Reconnect GitLab"
          description="Your GitLab sign-in expired or was revoked. Reconnect it on your Profile to keep using automation."
          action={
            <Button asChild>
              <Link href="/profile">Reconnect GitLab</Link>
            </Button>
          }
        />
      );
    default:
      return null;
  }
}
