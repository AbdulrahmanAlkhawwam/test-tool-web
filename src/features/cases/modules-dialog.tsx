'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { ModuleSummary } from '@/lib/types';
import { useCreateModule, useDeleteModule, useUpdateModule } from './api';

const CODE_RE = /^[A-Z][A-Z0-9]{0,9}$/;

/** "Authentication" → "AUTH", "User Management" → "UM" (same rule as the importer). */
export function suggestModuleCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join('').slice(0, 10);
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

interface ModulesDialogProps {
  projectId: string;
  modules: ModuleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModulesDialog({ projectId, modules, open, onOpenChange }: ModulesDialogProps) {
  const create = useCreateModule(projectId);
  const update = useUpdateModule(projectId);
  const remove = useDeleteModule(projectId);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);

  const codeValid = CODE_RE.test(code);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !codeValid) return;
    try {
      await create.mutateAsync({ name: name.trim(), code });
      setName('');
      setCode('');
      setCodeTouched(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the module'));
    }
  }

  async function rename(id: string, current: string, next: string) {
    if (!next.trim() || next.trim() === current) return;
    try {
      await update.mutateAsync({ id, input: { name: next.trim() } });
      toast.success('Module renamed');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rename the module'));
    }
  }

  async function del(module: ModuleSummary) {
    try {
      await remove.mutateAsync(module.id);
      toast.success(`Module ${module.code} deleted`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the module'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modules</DialogTitle>
          <DialogDescription>
            The module code is used in test case IDs, e.g. <span className="font-mono">TC-AUTH-001</span>.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-md border">
          {modules.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No modules yet.</li>}
          {modules.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{m.code}</span>
              <Input
                aria-label={`Name of module ${m.code}`}
                defaultValue={m.name}
                className="h-8"
                onBlur={(e) => void rename(m.id, m.name, e.target.value)}
              />
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{m.caseCount} cases</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`Delete module ${m.code}`}
                disabled={m.caseCount > 0 || remove.isPending}
                title={m.caseCount > 0 ? 'Only modules without test cases can be deleted' : undefined}
                onClick={() => void del(m)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="module-name">New module</Label>
            <Input
              id="module-name"
              placeholder="Authentication"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setCode(suggestModuleCode(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="module-code">Code</Label>
            <Input
              id="module-code"
              className="font-mono uppercase"
              value={code}
              aria-invalid={!!code && !codeValid}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
            />
          </div>
          <Button type="submit" disabled={!name.trim() || !codeValid || create.isPending}>
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
