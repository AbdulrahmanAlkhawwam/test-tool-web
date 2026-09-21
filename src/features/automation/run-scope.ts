import { normalizeFolder } from '@/features/gitlab/paths';
import type { AutomatedRunScope, AutomatedScopeMode } from '@/lib/types';

export interface ScopeState {
  mode: AutomatedScopeMode;
  /** Folder or file for PATH (repository-relative, inside the tests folder). */
  path: string;
  caseIds: string[];
}

export function buildScope(state: ScopeState): AutomatedRunScope {
  switch (state.mode) {
    case 'PATH':
      return { mode: 'PATH', path: normalizeFolder(state.path) };
    case 'CASES':
      return { mode: 'CASES', caseIds: state.caseIds };
    default:
      return { mode: 'ALL' };
  }
}

export function scopeError(state: ScopeState, testsPath: string): string | null {
  if (state.mode === 'CASES' && state.caseIds.length === 0) return 'Choose at least one test case';
  if (state.mode !== 'PATH') return null;
  const path = normalizeFolder(state.path);
  const root = normalizeFolder(testsPath);
  if (!path) return 'Enter a folder or file inside the tests folder';
  if (path.split('/').some((s) => s === '.' || s === '..')) return 'The path can’t contain "." or ".." parts';
  if (root && path !== root && !path.startsWith(`${root}/`)) return `Choose a folder or file inside ${root}`;
  return null;
}
