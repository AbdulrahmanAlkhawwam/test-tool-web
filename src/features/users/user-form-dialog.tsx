'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import type { PublicUser } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useCreateUser, useUpdateUser } from './api';
import { editUserSchema, EditUserValues, newUserSchema, NewUserValues } from './schemas';

type Values = NewUserValues & EditUserValues;

interface UserFormDialogProps {
  user?: PublicUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormDialog({ user, open, onOpenChange }: UserFormDialogProps) {
  const { user: me } = useAuth();
  const isSelf = !!user && user.id === me?.id;
  const create = useCreateUser();
  const update = useUpdateUser();
  // One form serves both modes; the schema decides which fields are validated.
  const form = useForm<Values>({
    resolver: (user ? zodResolver(editUserSchema) : zodResolver(newUserSchema)) as Resolver<Values>,
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset({ name: user?.name ?? '', email: user?.email ?? '', password: '', role: user?.role ?? 'TESTER', active: user?.active ?? true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, input: { name: v.name, role: v.role, active: v.active, password: v.password || undefined } });
        toast.success(`${v.name} updated`);
      } else {
        await create.mutateAsync({ name: v.name, email: v.email, password: v.password, role: v.role });
        toast.success(`${v.name} can now sign in`);
      }
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not save the user';
      if (e instanceof ApiError && e.status === 409) form.setError('email', { message });
      else toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : 'Add user'}</DialogTitle>
        </DialogHeader>
        <form id="user-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" aria-invalid={!!errors.name} {...form.register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          {!user && (
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="user-password">{user ? 'New password (leave empty to keep)' : 'Temporary password'}</Label>
            <Input id="user-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                  <SelectTrigger id="user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TESTER">Tester: writes and runs test cases</SelectItem>
                    <SelectItem value="ADMIN">Admin: also manages users and projects</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {user && (
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox id="user-active" checked={field.value} disabled={isSelf} onCheckedChange={(v) => field.onChange(v === true)} />
                  <Label htmlFor="user-active" className="font-normal">
                    Active (can sign in)
                  </Label>
                </div>
              )}
            />
          )}
          {isSelf && <p className="text-xs text-muted-foreground">You can&apos;t change your own role or deactivate yourself.</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : user ? 'Save' : 'Add user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
