import Link from 'next/link';
import { StatusBar } from '@/components/status-bar';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import type { ProjectListItem } from '@/lib/types';

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const run = project.latestRun;
  return (
    <Link
      href={`/projects/${project.key}`}
      className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold group-hover:text-primary">{project.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
        </div>
        {project.archivedAt && <Badge variant="secondary">Archived</Badge>}
      </div>
      {project.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
      <div className="mt-4 space-y-2">
        {run ? (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">Latest run · {run.name}</span>
              <span className="shrink-0 font-medium">{run.summary.passRate}% passed</span>
            </div>
            <StatusBar summary={run.summary} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No runs yet</p>
        )}
      </div>
      <div className="mt-auto flex justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span>{project.caseCount} test cases</span>
        <span>{project.lastTestedAt ? `Tested ${formatRelative(project.lastTestedAt)}` : 'Not tested yet'}</span>
      </div>
    </Link>
  );
}
