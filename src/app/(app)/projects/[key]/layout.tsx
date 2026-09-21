'use client';

import { ExternalLink, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const TABS = [
  { segment: 'cases', label: 'Test Cases' },
  { segment: 'runs', label: 'Runs' },
  { segment: 'dashboard', label: 'Dashboard' },
  { segment: 'settings', label: 'Settings' },
];
const AUTOMATION_TAB = { segment: 'automation', label: 'Automation' };

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: { key: string } }) {
  const project = useProject(params.key);
  const gitlab = useGitlabStatus();
  const pathname = usePathname();

  if (project.isPending) return <LoadingState />;
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.status === 404) {
      return (
        <div className="py-16 text-center">
          <p className="font-medium">Project not found</p>
          <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to projects
          </Link>
        </div>
      );
    }
    return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  }

  // GitLab UI appears only while GitLab is enabled and the project is linked (spec §10).
  const access = automationAccess(gitlab.data, project.data);
  const repo = access.state === 'hidden' ? null : access.repo;
  const tabs = repo ? [...TABS.slice(0, 2), AUTOMATION_TAB, ...TABS.slice(2)] : TABS;
  const base = `/projects/${project.data.key}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.data.name}</h1>
          <Badge variant="outline" className="font-mono">
            {project.data.key}
          </Badge>
          {project.data.archivedAt && <Badge variant="secondary">Archived</Badge>}
          {repo && (
            <a
              href={repo.gitlabWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <GitBranch className="h-4 w-4" aria-hidden />
              <span className="font-mono">{repo.gitlabPath}</span>
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="sr-only">(opens GitLab)</span>
            </a>
          )}
        </div>
        {project.data.description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{project.data.description}</p>}
      </div>
      <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.segment}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
