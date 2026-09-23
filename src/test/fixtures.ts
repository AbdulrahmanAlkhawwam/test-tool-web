import type {
  ApiToken,
  AutomationBranch,
  AutomationBranches,
  AutomationFile,
  AutomationTree,
  AutomationTreeEntry,
  MergeRequestRef,
  Paged,
  ProjectDetail,
  RepositoryLink,
  TestCaseDetail,
  TestCaseListItem,
  TestCaseSuggestion,
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

/** GET /users/me/tokens row. Active by default; pass `revokedAt` or a past `expiresAt` for the other states. */
export const apiToken = (extra: Partial<ApiToken> = {}): ApiToken => ({
  id: 't1',
  name: 'Amina laptop',
  purpose: 'MCP',
  prefix: 'a1b2c3d4',
  createdAt: '2026-09-01T09:00:00.000Z',
  expiresAt: '2026-12-21T09:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  ...extra,
});

/** A project with one module, for the Test Cases tab and the case detail page. */
export const caseProject: ProjectDetail = {
  id: 'p1',
  name: 'Ninja Store',
  key: 'NINJA',
  description: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  modules: [{ id: 'm1', name: 'Authentication', code: 'AUTH', caseCount: 3 }],
};

/** A row of GET /projects/:id/test-cases. Approved by default; pass `reviewState: 'AI_DRAFT'` for a draft. */
export const caseItem = (id: string, code: string, extra: Partial<TestCaseListItem> = {}): TestCaseListItem => ({
  id,
  projectId: 'p1',
  moduleId: 'm1',
  code,
  name: `Case ${code}`,
  description: null,
  preconditions: null,
  steps: null,
  testData: null,
  expectedResult: null,
  priority: 'MEDIUM',
  notes: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  deletedAt: null,
  module: { id: 'm1', name: 'Authentication', code: 'AUTH' },
  reviewState: 'APPROVED',
  createdVia: 'WEB',
  latestResult: null,
  ...extra,
});

export const pagedCases = (
  items: TestCaseListItem[],
  extra: { total?: number; page?: number; pageSize?: number } = {},
): Paged<TestCaseListItem> => ({
  items,
  total: extra.total ?? items.length,
  page: extra.page ?? 1,
  pageSize: extra.pageSize ?? 50,
});

/** GET /test-cases/:id body. */
export const caseDetail = (extra: Partial<TestCaseDetail> = {}): TestCaseDetail => ({
  ...caseItem('c1', 'TC-AUTH-001'),
  createdBy: { id: 'u1', name: 'Amina' },
  updatedBy: { id: 'u1', name: 'Amina' },
  history: [],
  ...extra,
});

/** GET /test-cases/:id/suggestion body. */
export const suggestion = (extra: Partial<TestCaseSuggestion> = {}): TestCaseSuggestion => ({
  id: 's1',
  testCaseId: 'c1',
  changes: { steps: { from: '1. Open Login', to: '1. Open Login\n2. Tap Forgot password' } },
  status: 'PENDING',
  rationale: 'The Login screen now has a Forgot password link.',
  createdBy: { id: 'u9', name: 'Amina' },
  createdAt: '2026-09-20T08:00:00.000Z',
  ...extra,
});
