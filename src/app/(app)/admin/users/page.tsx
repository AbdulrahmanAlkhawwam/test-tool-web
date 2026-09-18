'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/features/users/api';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { UsersTable } from '@/features/users/users-table';
import type { PublicUser } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

function UsersAdmin() {
  const users = useUsers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | undefined>();

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Everyone who can sign in to Ejad Test Cases.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
          Add user
        </Button>
      </div>
      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <UsersTable
          users={users.data}
          onEdit={(u) => {
            setEditing(u);
            setOpen(true);
          }}
        />
      )}
      <UserFormDialog user={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default function UsersPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <UsersAdmin /> : <EmptyState title="Admins only" description="Ask an admin if you need access to user management." />;
}
