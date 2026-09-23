'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import type { TokenExpiryDays } from '@/lib/types';
import { useCreateToken } from './api';
import { DEFAULT_EXPIRY_DAYS, EXPIRY_OPTIONS, expiryOptionLabel } from './mcp-setup';

/**
 * Creates one personal access token (spec §4). The full value is handed to `onCreated` and the
 * mutation is reset straight away, so nothing but the parent's state holds it.
 */
export function NewTokenDialog({ onCreated }: { onCreated: (created: { name: string; token: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<TokenExpiryDays>(DEFAULT_EXPIRY_DAYS);
  const create = useCreateToken();
  const queryClient = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    try {
      const created = await create.mutateAsync({ name: trimmed, expiresInDays });
      onCreated({ name: created.name, token: created.token });
      // `reset()` only detaches this hook's observer — the underlying Mutation object (and its
      // `data`, which is the full token) stays in the MutationCache until garbage-collected. Remove
      // it outright so the token cannot be read back from `queryClient.getMutationCache()`.
      create.reset();
      queryClient
        .getMutationCache()
        .getAll()
        .filter((m) => (m.state.data as { token?: string } | undefined)?.token === created.token)
        .forEach((m) => queryClient.getMutationCache().remove(m));
      setOpen(false);
      setName('');
      setExpiresInDays(DEFAULT_EXPIRY_DAYS);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the token');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName('');
          setExpiresInDays(DEFAULT_EXPIRY_DAYS);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New AI access token</DialogTitle>
          <DialogDescription>
            The token acts as you, with your role. You will see its value once, right after you create it.
          </DialogDescription>
        </DialogHeader>
        <form id="new-token" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              maxLength={60}
              placeholder="Amina laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-expiry">Expires after</Label>
            <Select
              value={String(expiresInDays)}
              onValueChange={(v) => setExpiresInDays(Number(v) as TokenExpiryDays)}
              disabled={create.isPending}
            >
              <SelectTrigger id="token-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {expiryOptionLabel(days)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-token" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
