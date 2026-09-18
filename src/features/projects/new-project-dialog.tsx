'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useCreateProject } from './api';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, '2–10 letters or digits, starting with a letter'),
  description: z.string().trim().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

/** "Ninja Store" → "NINJA": first word's letters/digits, up to 10 characters. */
function suggestKey(name: string): string {
  return (name.toUpperCase().match(/[A-Z][A-Z0-9]*/)?.[0] ?? '').slice(0, 10);
}

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateProject();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', key: '', description: '' } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const project = await create.mutateAsync({ ...values, description: values.description || undefined });
      toast.success(`Project ${project.name} created`);
      setOpen(false);
      form.reset();
      router.push(`/projects/${project.key}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not create the project';
      if (e instanceof ApiError && e.status === 409) form.setError('key', { message });
      else toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>The key is used in URLs and can&apos;t be changed later.</DialogDescription>
        </DialogHeader>
        <form id="new-project" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              aria-invalid={!!errors.name}
              {...form.register('name', {
                onChange: (e) => {
                  if (!form.getFieldState('key').isDirty) form.setValue('key', suggestKey(e.target.value));
                },
              })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-key">Key</Label>
            <Input id="project-key" className="font-mono uppercase" aria-invalid={!!errors.key} {...form.register('key')} />
            {errors.key && <p className="text-xs text-destructive">{errors.key.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Textarea id="project-description" rows={3} {...form.register('description')} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-project" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
