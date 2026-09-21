import { describe, expect, it } from 'vitest';
import { linkedProject, repo, unlinkedProject } from '@/test/fixtures';
import { automationAccess, repositoryOf } from './access';

describe('gitlab access', () => {
  it('reads the repository link from the project', () => {
    expect(repositoryOf(linkedProject)).toEqual(repo);
    expect(repositoryOf(unlinkedProject)).toBeNull();
    expect(repositoryOf({ ...linkedProject, testsPath: null })).toBeNull();
    expect(repositoryOf({ ...linkedProject, playwrightConfigPath: null })?.playwrightConfigPath).toBe('playwright.config.ts');
  });

  it('shows GitLab UI only when enabled and linked, and asks to (re)connect first', () => {
    const active = { enabled: true, connection: { username: 'amina', state: 'ACTIVE' as const } };
    expect(automationAccess(undefined, linkedProject)).toEqual({ state: 'hidden' });
    expect(automationAccess({ enabled: false, connection: null }, linkedProject)).toEqual({ state: 'hidden' });
    expect(automationAccess(active, unlinkedProject)).toEqual({ state: 'hidden' });
    expect(automationAccess({ enabled: true, connection: null }, linkedProject)).toEqual({ state: 'connect', repo });
    expect(
      automationAccess({ enabled: true, connection: { username: 'amina', state: 'NEEDS_RECONNECT' } }, linkedProject),
    ).toEqual({ state: 'reconnect', repo });
    expect(automationAccess(active, linkedProject)).toEqual({ state: 'ready', repo, username: 'amina' });
  });
});
