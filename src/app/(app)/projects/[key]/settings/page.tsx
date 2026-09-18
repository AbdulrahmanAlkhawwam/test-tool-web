'use client';

import { useProject } from '@/features/projects/api';
import { ProjectSettingsForm } from '@/features/projects/project-settings-form';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const { isAdmin } = useAuth();
  if (!project.data) return null;
  if (!isAdmin) {
    return (
      <div className="max-w-xl space-y-2 rounded-xl border bg-card p-5 text-sm">
        <p>
          <span className="text-muted-foreground">Key:</span> <span className="font-mono">{project.data.key}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Created:</span> {formatDateTime(project.data.createdAt)}
        </p>
        <p className="text-muted-foreground">Only admins can change project settings.</p>
      </div>
    );
  }
  return <ProjectSettingsForm key={project.data.id + project.data.name} project={project.data} />;
}
