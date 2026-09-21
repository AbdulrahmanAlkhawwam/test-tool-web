'use client';

import { FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinPath, newFilePathError, normalizeFolder } from '@/features/gitlab/paths';

interface NewFileDialogProps {
  testsPath: string;
  /** Repository paths of the files that already exist on the branch. */
  existing: Set<string>;
  onCreate: (path: string) => void;
}

/** New file inside the tests folder only (spec §6). It exists in GitLab once it is saved. */
export function NewFileDialog({ testsPath, existing, onCreate }: NewFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const folder = normalizeFolder(testsPath);
  const fullPath = joinPath(folder, name);
  const error = newFilePathError(name) ?? (existing.has(fullPath) ? 'A file with this path already exists' : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePlus2 className="mr-1.5 h-4 w-4" aria-hidden />
          New file
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New test file</DialogTitle>
          <DialogDescription>
            The file is created in <span className="font-mono">{folder}</span> on your work branch when you save it.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-file-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (error) return;
            onCreate(fullPath);
            setOpen(false);
          }}
        >
          <Label htmlFor="new-file-path">File path</Label>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm text-muted-foreground">{folder}/</span>
            <Input id="new-file-path" className="font-mono" placeholder="auth/login.spec.ts" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {name.trim() && error && <p className="text-xs text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-file-form" disabled={!!error}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
