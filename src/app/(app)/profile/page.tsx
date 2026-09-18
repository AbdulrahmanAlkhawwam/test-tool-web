'use client';

import { ChangePasswordForm } from '@/features/users/change-password-form';
import { useAuth } from '@/providers/auth-provider';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          {user?.name} · {user?.email} · {user?.role === 'ADMIN' ? 'Admin' : 'Tester'}
        </p>
      </div>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-medium">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
