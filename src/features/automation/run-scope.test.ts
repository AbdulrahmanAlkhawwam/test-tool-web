import { describe, expect, it } from 'vitest';
import { buildScope, scopeError, type ScopeState } from './run-scope';

const base: ScopeState = { mode: 'ALL', path: 'e2e/auth', caseIds: ['c1'] };

describe('automated run scope', () => {
  it('sends only the field that belongs to the mode', () => {
    expect(buildScope(base)).toEqual({ mode: 'ALL' });
    expect(buildScope({ ...base, mode: 'PATH', path: '/e2e/auth/' })).toEqual({ mode: 'PATH', path: 'e2e/auth' });
    expect(buildScope({ ...base, mode: 'CASES' })).toEqual({ mode: 'CASES', caseIds: ['c1'] });
  });

  it('explains what is missing or outside the tests folder', () => {
    expect(scopeError({ ...base, mode: 'CASES', caseIds: [] }, 'e2e')).toBe('Choose at least one test case');
    expect(scopeError({ ...base, mode: 'PATH', path: ' ' }, 'e2e')).toBe('Enter a folder or file inside the tests folder');
    expect(scopeError({ ...base, mode: 'PATH', path: 'src/app' }, 'e2e')).toBe('Choose a folder or file inside e2e');
    expect(scopeError({ ...base, mode: 'PATH', path: 'e2e2/x.spec.ts' }, 'e2e')).toBe('Choose a folder or file inside e2e');
    expect(scopeError({ ...base, mode: 'PATH', path: 'e2e/../src' }, 'e2e')).toBe('The path can’t contain "." or ".." parts');
  });

  it('accepts the tests folder, its sub-folders and files', () => {
    expect(scopeError(base, 'e2e')).toBeNull();
    expect(scopeError({ ...base, mode: 'PATH', path: 'e2e' }, 'e2e/')).toBeNull();
    expect(scopeError({ ...base, mode: 'PATH', path: './e2e/auth/' }, 'e2e')).toBeNull();
    expect(scopeError({ ...base, mode: 'PATH', path: 'e2e/auth/login.spec.ts' }, 'e2e')).toBeNull();
  });
});
