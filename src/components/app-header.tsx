'use client';

import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnsavedChanges } from '@/lib/unsaved-changes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export function AppHeader() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const hasUnsavedChanges = useUnsavedChanges();
  const [confirmLogout, setConfirmLogout] = useState(false);

  function requestLogout() {
    if (hasUnsavedChanges) setConfirmLogout(true);
    else void logout().catch(() => undefined);
  }
  const links = [
    { href: '/', label: 'Projects', active: pathname === '/' || pathname.startsWith('/projects') },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Users', active: pathname.startsWith('/admin') }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="h-0.5 bg-gradient-to-r from-brand-green to-brand-blue" aria-hidden />
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/ejad-logo.png" alt="Ejad" width={56} height={32} priority />
          <span className="hidden sm:inline">Test Cases</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted',
                l.active ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <UserRound className="h-4 w-4" aria-hidden />
                <span className="max-w-[10rem] truncate">{user?.name}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email} · {user?.role === 'ADMIN' ? 'Admin' : 'Tester'}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile & password</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={requestLogout}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Discard unsaved changes?"
        description="You have unsaved changes in the Automation editor. Logging out now will discard them."
        confirmLabel="Log out"
        destructive
        onConfirm={() => {
          setConfirmLogout(false);
          void logout().catch(() => undefined);
        }}
      />
    </header>
  );
}
