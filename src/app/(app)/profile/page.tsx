'use client';

import { Suspense } from 'react';
import { AiAccessCard } from '@/features/ai/ai-access-card';
import { GitlabCard } from '@/features/gitlab/gitlab-card';
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
      {/* GitlabCard reads ?gitlab=connected with useSearchParams, which needs a Suspense boundary for `next build`. */}
      <Suspense fallback={null}>
        <GitlabCard />
      </Suspense>
      <AiAccessCard />
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-medium">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
