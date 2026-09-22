'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify, workBranchName } from '@/features/gitlab/paths';

interface WorkNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  pending: boolean;
  onConfirm: (slug: string) => void;
}

/** Asked on the first save from the default branch (spec §6): names the work branch tests/<username>/<slug>. */
export function WorkNameDialog({ open, onOpenChange, username, pending, onConfirm }: WorkNameDialogProps) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  const slug = slugify(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name your work</DialogTitle>
          <DialogDescription>
            Your changes go to your own branch with a merge request, never straight to the default branch. Give the work a short
            name, e.g. “login fixes”.
          </DialogDescription>
        </DialogHeader>
        <form
          id="work-name-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (slug && !pending) onConfirm(slug);
          }}
        >
          <Label htmlFor="work-name">Work name</Label>
          <Input id="work-name" maxLength={60} placeholder="login fixes" value={name} onChange={(e) => setName(e.target.value)} />
          {slug ? (
            <p className="text-xs text-muted-foreground">
              Branch: <span className="font-mono">{workBranchName(username, slug)}</span>
            </p>
          ) : name.trim() ? (
            <p className="text-xs text-destructive">Use at least one letter or number (a–z, 0–9).</p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="work-name-form" disabled={!slug || pending}>
            {pending ? 'Saving…' : 'Save to my branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
