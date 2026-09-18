'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import type { ProjectDetail } from '@/lib/types';
import { useUpdateProject } from './api';

export function ProjectSettingsForm({ project }: { project: ProjectDetail }) {
  const update = useUpdateProject(project.id);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archived = !!project.archivedAt;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim(), description: description.trim() });
      toast.success('Project updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the project');
    }
  }

  async function toggleArchive() {
    try {
      await update.mutateAsync({ archived: !archived });
      toast.success(archived ? 'Project restored' : 'Project archived');
      setArchiveOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change the project');
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="max-w-xl space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Name</Label>
          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-key">Key</Label>
          <Input id="settings-key" value={project.key} disabled className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea id="settings-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit" disabled={update.isPending || name.trim().length < 2}>
          Save changes
        </Button>
      </form>

      <section className="max-w-xl space-y-2 rounded-xl border border-destructive/30 bg-card p-5">
        <h3 className="font-medium">{archived ? 'Restore project' : 'Archive project'}</h3>
        <p className="text-sm text-muted-foreground">
          {archived
            ? 'Show this project on the home page again.'
            : 'Hide this project from the home page. Its test cases and runs are kept and it can be restored.'}
        </p>
        <Button variant={archived ? 'outline' : 'destructive'} onClick={() => setArchiveOpen(true)}>
          {archived ? 'Restore project' : 'Archive project'}
        </Button>
      </section>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={archived ? `Restore ${project.name}?` : `Archive ${project.name}?`}
        description={archived ? 'It will appear on the home page again.' : 'It will be hidden from the home page until restored.'}
        confirmLabel={archived ? 'Restore' : 'Archive'}
        destructive={!archived}
        pending={update.isPending}
        onConfirm={() => void toggleArchive()}
      />
    </div>
  );
}
