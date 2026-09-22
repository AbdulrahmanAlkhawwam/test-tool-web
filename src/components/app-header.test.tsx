import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setUnsavedChanges } from '@/lib/unsaved-changes';
import { renderWithClient } from '@/test/render';
import { AppHeader } from './app-header';

const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Amina', email: 'amina@ejad.test', role: 'TESTER' },
  isAdmin: false,
  logout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('AppHeader logout', () => {
  afterEach(() => {
    vi.clearAllMocks();
    setUnsavedChanges(false);
  });

  // A single test, one render(): Radix's DropdownMenu here only ever opens correctly for the first
  // render() call in a test file under jsdom (a documented environment quirk, unrelated to this app's
  // code — reopening the SAME mounted instance is unaffected and is what a real user does anyway). A
  // second `it()` with its own renderWithClient() would never get its menu open, so every scenario that
  // needs the menu open lives in this one test, opening the SAME instance again for each step.
  it('logs out directly when clean; asks to confirm when dirty, and only logs out once confirmed', async () => {
    const user = userEvent.setup();
    renderWithClient(<AppHeader />);

    // Clean: no confirmation, logs out right away.
    await user.click(screen.getByRole('button', { name: /Amina/ }));
    await user.click(await screen.findByText('Log out'));
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    auth.logout.mockClear();

    // Dirty: asks first, and doesn't log out until that's confirmed.
    setUnsavedChanges(true);
    await user.click(screen.getByRole('button', { name: /Amina/ }));
    await user.click(await screen.findByText('Log out'));
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
