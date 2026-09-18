'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboard, useProjects } from '@/features/projects/api';
import { DashboardOverview } from '@/features/projects/dashboard-overview';
import { NewProjectDialog } from '@/features/projects/new-project-dialog';
import { ProjectCard } from '@/features/projects/project-card';
import { useAuth } from '@/providers/auth-provider';

export default function HomePage() {
  const { isAdmin } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const projects = useProjects(showArchived);
  const dashboard = useDashboard();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (projects.data ?? []).filter((p) => `${p.name} ${p.key}`.toLowerCase().includes(term));
  }, [projects.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Test cases and runs for every Ejad project</p>
        </div>
        {isAdmin && <NewProjectDialog />}
      </div>

      {dashboard.data && <DashboardOverview data={dashboard.data} />}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Search projects"
            aria-label="Search projects"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Checkbox id="show-archived" checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
            <Label htmlFor="show-archived" className="text-sm font-normal">
              Show archived
            </Label>
          </div>
        )}
      </div>

      {projects.isPending ? (
        <LoadingState />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching projects' : 'No projects yet'}
          description={isAdmin ? 'Create the first project to start writing test cases.' : 'Ask an admin to create a project.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
