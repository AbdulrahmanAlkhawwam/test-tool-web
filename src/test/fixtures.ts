import type {
  AutomationBranch,
  AutomationBranches,
  AutomationFile,
  AutomationTree,
  AutomationTreeEntry,
  MergeRequestRef,
  ProjectDetail,
  RepositoryLink,
} from '@/lib/types';

export const mergeRequest: MergeRequestRef = {
  iid: 7,
  webUrl: 'https://git.ejad.net/mobile/ninja-store/-/merge_requests/7',
  state: 'opened',
};

export const repo: RepositoryLink = {
  gitlabProjectId: 42,
  gitlabPath: 'mobile/ninja-store',
  gitlabWebUrl: 'https://git.ejad.net/mobile/ninja-store',
  defaultBranch: 'main',
  testsPath: 'e2e',
  playwrightConfigPath: 'playwright.config.ts',
};

export const unlinkedProject: ProjectDetail = {
  id: 'p1',
  name: 'Ninja Store',
  key: 'NINJA',
  description: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  modules: [],
};

export const linkedProject: ProjectDetail = { ...unlinkedProject, ...repo };

export const mainBranch: AutomationBranch = { name: 'main', isDefault: true, mergeRequest: null };
export const workBranch: AutomationBranch = { name: 'tests/amina/login-fixes', isDefault: false, mergeRequest };

/** GET …/automation/branches body. */
export const branchList = (...branches: AutomationBranch[]): AutomationBranches => ({ defaultBranch: 'main', branches });

/** GET …/automation/tree body. */
export const treeAt = (ref: string, entries: AutomationTreeEntry[]): AutomationTree => ({ ref, testsPath: 'e2e', entries });

/** GET …/automation/file body for e2e/login.spec.ts (or `path`). */
export const fileAt = (ref: string, content: string, lastCommitId: string, extra: Partial<AutomationFile> = {}): AutomationFile => ({
  path: 'e2e/login.spec.ts',
  ref,
  content,
  lastCommitId,
  size: content.length,
  readOnly: false,
  ...extra,
});
