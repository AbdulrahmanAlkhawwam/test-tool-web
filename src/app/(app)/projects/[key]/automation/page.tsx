'use client';

import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { AutomationView } from '@/features/automation/automation-view';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';

export default function AutomationPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const gitlab = useGitlabStatus();
  if (!project.data) return null;
  if (gitlab.isPending) return <LoadingState />;
  if (gitlab.isError) return <ErrorState error={gitlab.error} onRetry={() => gitlab.refetch()} />;

  const access = automationAccess(gitlab.data, project.data);
  switch (access.state) {
    case 'hidden':
      return (
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
      return <AutomationView project={project.data} repo={access.repo} username={access.username} />;
  }
}
