# Ejad Test Case Tool — Web Phase 2 (GitLab Automation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the web half of GitLab test automation to `ejad-testcases-web`. Testers connect their own GitLab account on the Profile page, and admins link a project to its GitLab repository and tests folder (Settings → Repository). Linked projects get an **Automation** tab: a branch selector, the tests-folder file tree, a Monaco editor whose Save commits to the tester's work branch and opens a merge request, coverage by `@TC-…` tags, a "Not automated yet" list, the CI job snippet, and a **Run tests** dialog. Automated runs show their branch, a live pipeline status badge and link, the importer's note, artifact links on failed results, and "Create test case from this" on Unlinked results.

**Architecture:** Same shape as Phase 1: Next.js 14 App Router client pages, TanStack Query hooks in `src/features/<domain>/api.ts`, and shadcn/ui components. All GitLab endpoints (spec §9) get typed hooks in `src/features/gitlab/api.ts`. Pure helpers (branch slugs, path rules, tree building, scopes, pipeline labels, module guessing) are separate, unit-tested modules. The Automation tab lives in `src/features/automation/`. Monaco loads through `next/dynamic` with `ssr: false`. It is served from `/public/monaco` (copied from `node_modules` by a `predev`/`prebuild` script), so it needs no CDN. Component tests replace it with a `<textarea>`. Automated runs reuse the Phase 1 run screens. They are read-only in the UI (the importer owns their results), and their run and run-list queries refetch every 10 s while a pipeline runs.

**Tech Stack:** Phase 1 stack (Next.js 14.2, React 18, TypeScript 5, Tailwind 3 + shadcn/ui, TanStack Query 5, sonner, lucide-react, Vitest + Testing Library), plus `@monaco-editor/react` 4.7 and `monaco-editor` 0.52.

**Spec:** `../ejad-testcases-api/docs/superpowers/specs/2026-09-18-gitlab-automation-design.md` (read §4, §5, §6, §7, §9, §10, §12 "Web", §13 steps 4–5). The API contract is §9 of that spec. Task 1 pins the request/response shapes as TypeScript types in `src/lib/types.ts`. They use the §8 field names and match the API Phase 2 plan `../ejad-testcases-api/docs/superpowers/plans/2026-09-18-api-phase2-gitlab.md` (Tasks 3–9 **Interfaces → Produces**). If that plan changes a shape, change only `src/lib/types.ts`, `src/features/gitlab/api.ts` and the test fixtures. The Phase 1 master spec is `../ejad-testcases-api/docs/superpowers/specs/2026-09-18-ejad-test-case-tool-design.md`.

## Global Constraints

- Repo root: `C:\Users\User\StudioProjects\ejad-testcases-web` (Git Bash: `/c/Users/User/StudioProjects/ejad-testcases-web`). Start from `main` after both `feat/web-phase1` and the final-review fix wave (`fix/web-final-review`: `safeNext` in `src/lib/safe-next.ts`, session-expiry handling in `src/lib/api.ts` / `auth-provider.tsx`, Complete-run guard, status-chip contrast, security headers) have been merged, on a new branch `feat/web-phase2-gitlab`. Dev server on **port 3001**. The API runs on `http://localhost:3000/api` (env `NEXT_PUBLIC_API_URL`).
- **Next.js 14 App Router, client pages:** every page and interactive component starts with `'use client'`. Nothing renders GitLab data on the server. A page that reads `useSearchParams` must render that part inside `<Suspense>`, or `next build` fails.
- **Brand and status colours are the Phase 1 tokens.** Primary actions use `bg-primary` (Ejad deep blue, darkened). Brand colours are `brand-green` / `brand-blue` / `brand-deep`. Status chips use the `StatusBadge` pattern (`bg-status-*/15 text-status-*-fg`), which has AA contrast, and never white text on a light status colour. Result labels stay exactly `Passed`, `Failed`, `Blocked`, `Skipped`, `Not Executed`. Pipeline badges use the same tokens: success = passed, failed = failed, running = brand blue, pending/created = pending, canceled/skipped = skipped. Fonts: IBM Plex Sans, with IBM Plex Mono for case codes, branches, paths and code.
- **GitLab is optional:** when `GET /api/gitlab/status` returns `enabled: false` (or 404), no GitLab UI renders at all: no Profile card, no Settings → Repository, no repo link, no Automation tab, no Run tests button.
- **Roles:** only admins see **Settings → Repository** and can link or unlink. Everyone else sees the Automation tab and Run tests like any tester.
- **Automation tab:** visible only when the project is linked (and GitLab is enabled). A user who is not connected, or whose connection is `NEEDS_RECONNECT`, gets "Connect GitLab to use automation" / "Reconnect GitLab" with a link to Profile.
- **Write rules (spec §6, §11):** editing happens only inside the tests folder. New-file paths are validated client-side (no `..`, must end in `.spec.ts`, `.test.ts`, `.ts` or `.js`), and the server re-validates them. Saves always go to the user's work branch `tests/<gitlab-username>-<slug>` plus a merge request, never to the default branch. The first save from the default branch asks for a short work name. Files over 1 MB open read-only. A 409 on save shows "This file changed on the branch – reload it before saving" with **Reload**.
- **Automated runs** are read-only in the web (no status editing, no Complete run). Their run detail and the runs list refetch every **10 s** while `type = AUTOMATED` and `status = IN_PROGRESS`.
- Every API error body is `{ statusCode, error, message, details? }`. Show `message` in toasts and inline errors (`ApiError.message`).
- Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Tests: `npm test` (Vitest) must pass with **no warnings** (no act() warnings, no Radix "missing Description" warnings, no jsdom "not implemented" errors). Component tests mock `fetch` through `src/test/fetch-routes.ts`, and never load Monaco (they `vi.mock('./code-editor', () => import('@/test/code-editor-mock'))`).
- **Test counts:** the baseline is **51** tests, which is the Phase 1 final count. There is no `.superpowers/sdd/2026-09-18-web-phase1/final-fix-report.md`, so the fix wave's own additions are unknown. Every "Expected: N tests pass" below is **51 + this plan's tests**. If the fix wave added B tests, expect N + B.

## File Structure

```
ejad-testcases-web/
  package.json                    + @monaco-editor/react, monaco-editor; predev/prebuild copy Monaco
  scripts/copy-monaco.mjs         copies node_modules/monaco-editor/min/vs → public/monaco/vs
  .gitignore                      + /public/monaco
  README.md                       + "GitLab automation" section
  src/
    lib/types.ts                  + GitLab types; ProjectDetail/TestRun/RunResult gain Phase 2 fields
    lib/navigate.ts               goTo(url): full-page navigation (mockable)
    test/                         test-only helpers (not test files)
      fetch-routes.ts             mockRoutes(), json(), apiError()
      render.tsx                  createWrapper(), renderWithClient()
      fixtures.ts                 linkedProject, repo, mainBranch, workBranch, mergeRequest
      code-editor-mock.tsx        <textarea> stand-in for Monaco
    app/(app)/profile/page.tsx                    + <GitlabCard/> in <Suspense>
    app/(app)/projects/[key]/layout.tsx           + repo link, Automation tab when linked
    app/(app)/projects/[key]/settings/page.tsx    + <RepositorySettings/> (admins)
    app/(app)/projects/[key]/automation/page.tsx  gate (connect/reconnect) + <AutomationView/>
    app/(app)/projects/[key]/runs/page.tsx        + <RunTestsDialog/> when ready
    features/
      gitlab/    api.ts (+ .test.ts), paths.ts (+ .test.ts), access.ts (+ .test.ts),
                 gitlab-card.tsx (+ .test.tsx), repository-settings.tsx (+ .test.tsx)
      automation/ file-tree.ts (+ .test.ts), file-tree-view.tsx, branch-select.tsx, merge-request-link.tsx,
                 automation-view.tsx (+ .test.tsx), code-editor.tsx, editor-panel.tsx (+ .test.tsx),
                 work-name-dialog.tsx, new-file-dialog.tsx, coverage-section.tsx (+ .test.tsx),
                 ci-snippet.tsx (+ .test.tsx), run-scope.ts (+ .test.ts), run-tests-dialog.tsx (+ .test.tsx)
      runs/      pipeline.ts (+ .test.ts), module-guess.ts (+ .test.ts), pipeline-status-badge.tsx,
                 automated-run-info.tsx, automated-result-details.tsx, create-case-from-result-dialog.tsx,
                 automated-run.test.tsx; modified: api.ts (polling), run-list.tsx, run-header.tsx,
                 run-execution.tsx, result-row.tsx, new-run-dialog.tsx (export CasePicker)
```

---

### Task 1: GitLab types, API hooks and path helpers

**Files:**
- Modify: `src/lib/types.ts` (append GitLab types; extend `ProjectDetail`, `TestRun`, `RunResult`, `RunDetail`)
- Create: `src/lib/navigate.ts`, `src/test/fetch-routes.ts`, `src/test/render.tsx`, `src/test/fixtures.ts`, `src/features/gitlab/paths.ts`, `src/features/gitlab/access.ts`, `src/features/gitlab/api.ts`
- Test: `src/features/gitlab/paths.test.ts`, `src/features/gitlab/access.test.ts`, `src/features/gitlab/api.test.ts`

**Interfaces:**
- Consumes: `api`, `ApiError` (`src/lib/api.ts`); `projectKeys` (`features/projects/api.ts`); `caseKeys` (`features/cases/api.ts`); `runKeys` (`features/runs/api.ts`). API: every endpoint in spec §9.
- Produces:
  - Types (`src/lib/types.ts`): `GitlabConnectionState`, `GitlabConnectionInfo { username, state, avatarUrl? }`, `GitlabStatus { enabled, connection }`, `GitlabProjectOption { id, name, pathWithNamespace, webUrl, defaultBranch }`, `RepositoryLink { gitlabProjectId, gitlabPath, gitlabWebUrl, defaultBranch, testsPath, playwrightConfigPath }`, `RepositoryInput`, `MergeRequestState`, `MergeRequestRef { iid, webUrl, state }`, `AutomationBranch { name, isDefault, mergeRequest }`, `AutomationBranches { defaultBranch, branches }`, `AutomationTreeEntry { path, name, type }`, `AutomationTree { ref, testsPath, entries }`, `AutomationFile { path, ref, content, lastCommitId, size, readOnly }`, `SaveFileInput { path, content, lastCommitId?, branchSlug }`, `SaveFileResult { branch, commitId, mergeRequest }`, `CoverageCase { id, code, name }`, `CoverageFile { path, cases, unknownCodes }`, `NotAutomatedCase { id, code, name, module: { code, name } }`, `CoverageReport { ref, commitId, files, notAutomated }`, `AutomatedScopeMode`, `AutomatedRunScope { mode, path?, caseIds? }`, `AutomatedRunInput { branch, name?, scope }`, `CreateCaseFromResultInput { moduleId, name?, priority? }`, `CreateCaseFromResultResponse { testCase, resultId, tag }`, `CiSnippetResponse { playwrightConfigPath, yaml }`. `RunDetail` gains optional `triggeredBy`. These are the API Phase 2 plan's response shapes (its Tasks 3–9 **Produces**). `ProjectDetail` gains optional `gitlabProjectId, gitlabPath, gitlabWebUrl, defaultBranch, testsPath, playwrightConfigPath`. `TestRun` gains optional `branch, pipelineId, pipelineWebUrl, pipelineStatus, triggeredById, note`. `RunResult` gains optional `file, artifactsUrl, durationMs, errorMessage`.
  - `goTo(url): void`
  - `gitlabKeys`, `automationKeys`; hooks `useGitlabStatus()`, `useStartGitlabConnect()`, `useDisconnectGitlab()`, `useGitlabProjects(search)`, `useLinkRepository(projectId)`, `useUnlinkRepository(projectId)`, `useAutomationBranches(projectId, enabled?)`, `useAutomationTree(projectId, ref)`, `useAutomationFile(projectId, ref, path | null)`, `useSaveAutomationFile(projectId)`, `useCoverage(projectId, ref)`, `useCiSnippet(projectId)`, `useRunAutomated(projectId)`, `useCreateCaseFromResult(runId, projectId)` (variables `{ resultId, input }` → `{ testCase, resultId, tag }`). `useCiSnippet` selects the `yaml` string. `isConnectionError(e)`: branches, save and run-automated refetch the GitLab status on a 403 `GITLAB_NOT_CONNECTED` / `GITLAB_NEEDS_RECONNECT`, so the Automation page switches to its connect/reconnect prompt.
  - `paths.ts`: `MAX_EDITABLE_BYTES`, `slugify`, `workBranchName`, `slugFromWorkBranch`, `initialBranch`, `normalizeFolder`, `testsFolderError`, `newFilePathError`, `joinPath`, `languageFor`, `reportUrlFromArtifacts`, `byteLength`
  - `access.ts`: `repositoryOf(project): RepositoryLink | null`, `type AutomationAccess`, `automationAccess(status, project)`
  - Test helpers: `mockRoutes(routes) → { calls, callsTo, fetchMock }`, `json`, `apiError`, `createWrapper`, `renderWithClient`; fixtures `repo`, `linkedProject`, `unlinkedProject`, `mergeRequest`, `mainBranch`, `workBranch`, `branchList(...)`, `treeAt(ref, entries)`, `fileAt(ref, content, lastCommitId, extra?)`
  - `paths.ts` also exports `workBranchPrefix(username)` (lower-cased like the API's)

- [ ] **Step 1: Add the Phase 2 types**

In `src/lib/types.ts`, replace the `ProjectDetail` interface with:
```ts
export interface ProjectDetail {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  modules: ModuleSummary[];
  /** GitLab repository link (GitLab spec §5). Absent or null until an admin links a repository. */
  gitlabProjectId?: number | null;
  gitlabPath?: string | null;
  gitlabWebUrl?: string | null;
  defaultBranch?: string | null;
  testsPath?: string | null;
  playwrightConfigPath?: string | null;
}
```

Replace the `TestRun` interface with:
```ts
export interface TestRun {
  id: string;
  projectId: string;
  name: string;
  build: string | null;
  environment: string | null;
  type: RunType;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  // Automated (GitLab CI) runs, GitLab spec §7–§8. Optional so manual-run fixtures and older responses stay valid.
  branch?: string | null;
  pipelineId?: number | null;
  pipelineWebUrl?: string | null;
  /** GitLab's pipeline status: pending, running, success, failed, canceled, … (null until the pipeline exists). */
  pipelineStatus?: string | null;
  triggeredById?: string | null;
  /** Set by the importer, e.g. "Pipeline finished without a test report" or GitLab's error message. */
  note?: string | null;
}
```

Replace the `RunResult` interface with:
```ts
export interface RunResult {
  id: string;
  runId: string;
  testCaseId: string | null;
  title: string | null;
  status: ResultStatus;
  actualResult: string | null;
  notes: string | null;
  executedAt: string | null;
  executedBy: UserRef | null;
  testCase: RunCase | null;
  // Automated results (GitLab spec §7–§8). Unmatched selected cases keep NOT_EXECUTED with notes "No automated test found".
  file?: string | null;
  /** The job's artifacts browser: <gitlabWebUrl>/-/jobs/<jobId>/artifacts/browse */
  artifactsUrl?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
}
```

In `RunDetail`, add this line after `createdBy: UserRef;`. The API includes the user who started an automated run:
```ts
  triggeredBy?: UserRef | null;
```

Append to `src/lib/types.ts`:
```ts
// ---- GitLab automation (GitLab spec §4–§9) ----

export type GitlabConnectionState = 'ACTIVE' | 'NEEDS_RECONNECT';

export interface GitlabConnectionInfo {
  username: string;
  state: GitlabConnectionState;
  /** Shown on the Profile card when the API includes it (spec §10: "username + avatar"). */
  avatarUrl?: string | null;
}

/** GET /gitlab/status */
export interface GitlabStatus {
  enabled: boolean;
  connection: GitlabConnectionInfo | null;
}

/** One result of GET /gitlab/projects?search= (admin, for linking): GitLab's project, camelCased by the API. */
export interface GitlabProjectOption {
  /** Becomes Project.gitlabProjectId. */
  id: number;
  name: string;
  /** Becomes Project.gitlabPath, e.g. "mobile/ninja-store". */
  pathWithNamespace: string;
  /** Becomes Project.gitlabWebUrl. */
  webUrl: string;
  defaultBranch: string | null;
}

/** A project's repository link, read from ProjectDetail (see repositoryOf). */
export interface RepositoryLink {
  gitlabProjectId: number;
  gitlabPath: string;
  gitlabWebUrl: string;
  defaultBranch: string;
  testsPath: string;
  playwrightConfigPath: string;
}

/** PUT /projects/:id/repository → the saved link (RepositoryLink plus the project id). The web always sends all four fields. */
export type RepositoryInput = Pick<RepositoryLink, 'gitlabProjectId' | 'defaultBranch' | 'testsPath' | 'playwrightConfigPath'>;

export type MergeRequestState = 'opened' | 'closed' | 'merged' | 'locked';

export interface MergeRequestRef {
  iid: number;
  webUrl: string;
  state: MergeRequestState;
}

export interface AutomationBranch {
  name: string;
  isDefault: boolean;
  mergeRequest: MergeRequestRef | null;
}

/** GET /projects/:id/automation/branches: the default branch plus the current user's work branches. */
export interface AutomationBranches {
  defaultBranch: string;
  branches: AutomationBranch[];
}

export interface AutomationTreeEntry {
  /** Repository-relative, e.g. "e2e/auth/login.spec.ts". */
  path: string;
  name: string;
  type: 'tree' | 'blob';
}

/** GET /projects/:id/automation/tree?ref= (recursive, limited to testsPath). */
export interface AutomationTree {
  ref: string;
  testsPath: string;
  entries: AutomationTreeEntry[];
}

/** GET /projects/:id/automation/file?ref=&path= */
export interface AutomationFile {
  path: string;
  ref: string;
  content: string;
  lastCommitId: string;
  size: number;
  /** True for files over 1 MB (spec §6). */
  readOnly: boolean;
}

/** PUT /projects/:id/automation/file */
export interface SaveFileInput {
  path: string;
  content: string;
  /** Omitted for a new file. */
  lastCommitId?: string;
  branchSlug: string;
}

export interface SaveFileResult {
  branch: string;
  commitId: string;
  mergeRequest: MergeRequestRef;
}

export interface CoverageCase {
  id: string;
  code: string;
  name: string;
}

export interface CoverageFile {
  /** Repository-relative path, same as AutomationTreeEntry.path. */
  path: string;
  cases: CoverageCase[];
  /** @TC-… tags in this file that match no case in the project (their results come back Unlinked). */
  unknownCodes: string[];
}

export interface NotAutomatedCase extends CoverageCase {
  module: { code: string; name: string };
}

/** GET /projects/:id/automation/coverage?ref= (scanned per commit, spec §6) */
export interface CoverageReport {
  ref: string;
  commitId: string;
  files: CoverageFile[];
  notAutomated: NotAutomatedCase[];
}

export type AutomatedScopeMode = 'ALL' | 'PATH' | 'CASES';

export interface AutomatedRunScope {
  mode: AutomatedScopeMode;
  path?: string;
  caseIds?: string[];
}

/** POST /projects/:id/runs/automated → RunDetail (the API names the run "Automated · <branch> · <time>" when `name` is omitted) */
export interface AutomatedRunInput {
  branch: string;
  name?: string;
  scope: AutomatedRunScope;
}

/** POST /runs/:runId/results/:resultId/create-case. The API names the case from the test title when `name` is omitted. */
export interface CreateCaseFromResultInput {
  moduleId: string;
  name?: string;
  priority?: Priority;
}

/** The new case, the result now linked to it, and the tag to put in the test title (e.g. "@TC-CHK-001"). */
export interface CreateCaseFromResultResponse {
  testCase: TestCase;
  resultId: string;
  tag: string;
}

/** GET /projects/:id/automation/ci-snippet */
export interface CiSnippetResponse {
  playwrightConfigPath: string;
  yaml: string;
}
```

- [ ] **Step 2: Full-page navigation**

`src/lib/navigate.ts`:
```ts
/** Full-page navigation to another site (e.g. GitLab's OAuth screen). A module of its own so tests can mock it. */
export function goTo(url: string): void {
  window.location.assign(url);
}
```

- [ ] **Step 3: Test helpers**

`src/test/fetch-routes.ts`:
```ts
import { vi } from 'vitest';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, message: string) =>
  json(status, { statusCode: status, error: status === 409 ? 'Conflict' : 'Error', message });

export interface MockCall {
  method: string;
  /** Path without the `/api` prefix, e.g. `/projects/p1/automation/tree`. */
  path: string;
  query: Record<string, string>;
  body: unknown;
}

/** A plain value is sent as a 200 JSON body. A function receives the call and may return a Response. */
export type Route = ((call: MockCall) => unknown) | object | string | number | boolean | null;

/**
 * Stubs global fetch with a table of `"METHOD /path"` routes. Unknown routes answer 404 with an API error
 * body, so a missing mock shows up as a visible error state instead of a hang. Return a new Response from
 * a function each time (a Response body can only be read once).
 */
export function mockRoutes(routes: Record<string, Route>) {
  const calls: MockCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call: MockCall = {
      method: init.method ?? 'GET',
      path: url.pathname.replace(/^\/api/, ''),
      query: Object.fromEntries(url.searchParams),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    if (route === undefined) return apiError(404, `No mock for ${call.method} ${call.path}`);
    const result = typeof route === 'function' ? await (route as (c: MockCall) => unknown)(call) : route;
    return result instanceof Response ? result : json(200, result);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    fetchMock,
    callsTo: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  };
}
```

`src/test/render.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function createWrapper(queryClient: QueryClient = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper: Wrapper };
}

export function renderWithClient(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const { queryClient, wrapper } = createWrapper();
  return { queryClient, ...render(ui, { wrapper, ...options }) };
}
```

`src/test/fixtures.ts`:
```ts
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
export const workBranch: AutomationBranch = { name: 'tests/amina-login-fixes', isDefault: false, mergeRequest };

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
```

- [ ] **Step 4: Write the failing path and access tests**

`src/features/gitlab/paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mainBranch, mergeRequest, workBranch } from '@/test/fixtures';
import {
  byteLength,
  initialBranch,
  joinPath,
  languageFor,
  newFilePathError,
  normalizeFolder,
  reportUrlFromArtifacts,
  slugFromWorkBranch,
  slugify,
  testsFolderError,
  workBranchName,
} from './paths';

describe('gitlab paths', () => {
  it('turns a work name into a short branch slug', () => {
    expect(slugify('Login fixes')).toBe('login-fixes');
    expect(slugify('  Checkout: 3DS / retry!! ')).toBe('checkout-3ds-retry');
    expect(slugify('Café crème')).toBe('cafe-creme');
    expect(slugify('تجربة')).toBe('');
    expect(slugify(`${'x'.repeat(39)} yz`)).toBe('x'.repeat(39));
  });

  it('names work branches and recognises the user’s own', () => {
    expect(workBranchName('amina', 'login-fixes')).toBe('tests/amina-login-fixes');
    expect(workBranchName('Tess.Dev', 'x')).toBe('tests/tess.dev-x');
    expect(slugFromWorkBranch('tests/tess.dev-x', 'Tess.Dev')).toBe('x');
    expect(slugFromWorkBranch('tests/amina-login-fixes', 'amina')).toBe('login-fixes');
    expect(slugFromWorkBranch('tests/omar-login-fixes', 'amina')).toBeNull();
    expect(slugFromWorkBranch('tests/amina-', 'amina')).toBeNull();
    expect(slugFromWorkBranch('main', 'amina')).toBeNull();
  });

  it('opens the user’s work branch first, else the default branch', () => {
    const closed = { ...workBranch, name: 'tests/amina-old', mergeRequest: { ...mergeRequest, state: 'merged' as const } };
    expect(initialBranch([mainBranch, closed, workBranch], 'amina', 'main')).toBe('tests/amina-login-fixes');
    expect(initialBranch([mainBranch, closed], 'amina', 'main')).toBe('tests/amina-old');
    expect(initialBranch([mainBranch, workBranch], 'omar', 'main')).toBe('main');
    expect(initialBranch([], 'amina', 'develop')).toBe('develop');
  });

  it('accepts only test files inside the tests folder', () => {
    expect(newFilePathError('auth/login.spec.ts')).toBeNull();
    expect(newFilePathError('helpers/api.ts')).toBeNull();
    expect(newFilePathError('fixtures.js')).toBeNull();
    expect(newFilePathError('')).toBe('Enter a file name, e.g. auth/login.spec.ts');
    expect(newFilePathError('../secrets.spec.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('a/../b.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('a//b.ts')).toBe('The path can’t contain empty, "." or ".." parts');
    expect(newFilePathError('/abs.spec.ts')).toBe('Use a path relative to the tests folder, with forward slashes');
    expect(newFilePathError('a\\b.ts')).toBe('Use a path relative to the tests folder, with forward slashes');
    expect(newFilePathError('bad name.ts')).toBe('Use letters, numbers, ".", "-", "_" and "/" only');
    expect(newFilePathError('notes.md')).toBe('The file must end in .spec.ts, .test.ts, .ts or .js');
  });

  it('normalizes and validates the tests folder', () => {
    expect(normalizeFolder('/e2e/')).toBe('e2e');
    expect(normalizeFolder('./e2e')).toBe('e2e');
    expect(normalizeFolder('e2e\\smoke')).toBe('e2e/smoke');
    expect(testsFolderError('e2e')).toBeNull();
    expect(testsFolderError('  ')).toBe('Enter the tests folder, e.g. e2e');
    expect(testsFolderError('../other')).toBe('Use a folder inside the repository (no "..")');
    expect(joinPath('e2e/', 'auth/login.spec.ts')).toBe('e2e/auth/login.spec.ts');
    expect(joinPath('', 'login.spec.ts')).toBe('login.spec.ts');
  });

  it('picks the editor language from the extension', () => {
    expect(languageFor('e2e/login.spec.ts')).toBe('typescript');
    expect(languageFor('e2e/helpers.mjs')).toBe('javascript');
    expect(languageFor('e2e/data.json')).toBe('json');
    expect(languageFor('.gitlab-ci.yml')).toBe('yaml');
    expect(languageFor('e2e/README')).toBe('plaintext');
  });

  it('derives the Playwright report link from a job artifacts URL', () => {
    const browse = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/browse';
    const report = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/file/playwright-report/index.html';
    expect(reportUrlFromArtifacts(browse)).toBe(report);
    expect(reportUrlFromArtifacts(`${browse}/test-results`)).toBe(report);
    expect(reportUrlFromArtifacts('https://example.com/other')).toBeNull();
    expect(byteLength('é')).toBe(2);
  });
});
```

`src/features/gitlab/access.test.ts`:
```ts
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
```

Run: `npm test -- paths access`
Expected: FAIL with "Failed to resolve import './paths'" and "Failed to resolve import './access'".

- [ ] **Step 5: Implement the path and access helpers**

`src/features/gitlab/paths.ts`:
```ts
import type { AutomationBranch } from '@/lib/types';

/** Files larger than this open read-only (GitLab spec §6). */
export const MAX_EDITABLE_BYTES = 1024 * 1024;

/** A short work name ("Login fixes") → a branch slug ("login-fixes"): a–z, 0–9 and dashes, at most 40 characters. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** `tests/<username>-`, with the username normalized exactly like the API's workBranchPrefix. */
export function workBranchPrefix(username: string): string {
  return `tests/${username.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}-`;
}

export function workBranchName(username: string, slug: string): string {
  return `${workBranchPrefix(username)}${slug}`;
}

/** The slug of one of the user's work branches (`tests/<username>-<slug>`), or null for any other branch. */
export function slugFromWorkBranch(branch: string, username: string): string | null {
  const prefix = workBranchPrefix(username);
  return branch.startsWith(prefix) && branch.length > prefix.length ? branch.slice(prefix.length) : null;
}

/** The branch the Automation tab opens on: the user's work branch (one with an open MR first), else the default. */
export function initialBranch(branches: AutomationBranch[], username: string, defaultBranch: string): string {
  const own = branches.filter((b) => !b.isDefault && slugFromWorkBranch(b.name, username));
  const preferred = own.find((b) => b.mergeRequest?.state === 'opened') ?? own[0];
  return preferred?.name ?? branches.find((b) => b.isDefault)?.name ?? defaultBranch;
}

/** "e2e/", "/e2e", "./e2e" and "e2e\" all mean "e2e". */
export function normalizeFolder(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+|\/+$/g, '');
}

export function testsFolderError(path: string): string | null {
  const folder = normalizeFolder(path);
  if (!folder) return 'Enter the tests folder, e.g. e2e';
  if (folder.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'Use a folder inside the repository (no "..")';
  return null;
}

const NEW_FILE_EXTENSIONS = ['.spec.ts', '.test.ts', '.ts', '.js'];

/** Validates a new file path typed relative to the tests folder (spec §6). The API validates it again. */
export function newFilePathError(relative: string): string | null {
  const path = relative.trim();
  if (!path) return 'Enter a file name, e.g. auth/login.spec.ts';
  if (path.startsWith('/') || path.includes('\\')) return 'Use a path relative to the tests folder, with forward slashes';
  if (path.split('/').some((s) => s === '' || s === '.' || s === '..')) return 'The path can’t contain empty, "." or ".." parts';
  if (!/^[A-Za-z0-9._\-/]+$/.test(path)) return 'Use letters, numbers, ".", "-", "_" and "/" only';
  if (!NEW_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) return 'The file must end in .spec.ts, .test.ts, .ts or .js';
  return null;
}

export function joinPath(folder: string, relative: string): string {
  const base = normalizeFolder(folder);
  const rest = relative.trim().replace(/^\/+/, '');
  return base ? `${base}/${rest}` : rest;
}

export function languageFor(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

/** The Playwright HTML report inside a job's artifacts, from that job's artifacts-browser URL (spec §7). */
export function reportUrlFromArtifacts(artifactsUrl: string): string | null {
  const match = /^(.*\/-\/jobs\/\d+\/artifacts)\/browse(?:\/.*)?$/.exec(artifactsUrl);
  return match ? `${match[1]}/file/playwright-report/index.html` : null;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
```

`src/features/gitlab/access.ts`:
```ts
import type { GitlabStatus, ProjectDetail, RepositoryLink } from '@/lib/types';

export function repositoryOf(project: ProjectDetail): RepositoryLink | null {
  const { gitlabProjectId, gitlabPath, gitlabWebUrl, defaultBranch, testsPath } = project;
  if (gitlabProjectId == null || !gitlabPath || !gitlabWebUrl || !defaultBranch || !testsPath) return null;
  return {
    gitlabProjectId,
    gitlabPath,
    gitlabWebUrl,
    defaultBranch,
    testsPath,
    playwrightConfigPath: project.playwrightConfigPath || 'playwright.config.ts',
  };
}

export type AutomationAccess =
  | { state: 'hidden' }
  | { state: 'connect' | 'reconnect'; repo: RepositoryLink }
  | { state: 'ready'; repo: RepositoryLink; username: string };

/**
 * What the GitLab UI may show for a project: nothing (GitLab disabled, status still loading, or no linked
 * repository), a connect/reconnect prompt, or everything (spec §4, §10).
 */
export function automationAccess(status: GitlabStatus | undefined, project: ProjectDetail): AutomationAccess {
  const repo = repositoryOf(project);
  if (!status?.enabled || !repo) return { state: 'hidden' };
  const connection = status.connection;
  if (!connection) return { state: 'connect', repo };
  if (connection.state === 'NEEDS_RECONNECT') return { state: 'reconnect', repo };
  return { state: 'ready', repo, username: connection.username };
}
```

Run: `npm test -- paths access`
Expected: 9 tests pass.

- [ ] **Step 6: Write the failing API hook tests**

`src/features/gitlab/api.test.ts`:
```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockRoutes } from '@/test/fetch-routes';
import { fileAt, mergeRequest } from '@/test/fixtures';
import { createWrapper } from '@/test/render';
import {
  automationKeys,
  gitlabKeys,
  useAutomationBranches,
  useAutomationFile,
  useCiSnippet,
  useCreateCaseFromResult,
  useGitlabProjects,
  useGitlabStatus,
  useLinkRepository,
  useRunAutomated,
  useSaveAutomationFile,
  useStartGitlabConnect,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitLab API hooks', () => {
  it('reads the GitLab status', async () => {
    const status = { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } };
    const { callsTo } = mockRoutes({ 'GET /gitlab/status': status });
    const { result } = renderHook(() => useGitlabStatus(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(status);
    expect(callsTo('GET', '/gitlab/status')).toHaveLength(1);
  });

  it('treats a 404 status endpoint as GitLab disabled', async () => {
    mockRoutes({});
    const { result } = renderHook(() => useGitlabStatus(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ enabled: false, connection: null });
  });

  it('starts the OAuth flow and returns the GitLab authorize URL', async () => {
    mockRoutes({ 'GET /gitlab/oauth/start': { authorizeUrl: 'https://git.ejad.net/oauth/authorize?client_id=x' } });
    const { result } = renderHook(() => useStartGitlabConnect(), { wrapper: createWrapper().wrapper });
    let url = '';
    await act(async () => {
      url = (await result.current.mutateAsync()).authorizeUrl;
    });
    expect(url).toBe('https://git.ejad.net/oauth/authorize?client_id=x');
  });

  it('searches GitLab projects only once two characters are typed', async () => {
    const { callsTo } = mockRoutes({ 'GET /gitlab/projects': [] });
    const { result, rerender } = renderHook(({ search }: { search: string }) => useGitlabProjects(search), {
      wrapper: createWrapper().wrapper,
      initialProps: { search: 'n' },
    });
    expect(result.current.fetchStatus).toBe('idle');
    rerender({ search: 'ni ' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callsTo('GET', '/gitlab/projects').map((c) => c.query)).toEqual([{ search: 'ni' }]);
  });

  it('links a repository with PUT and refreshes the project', async () => {
    const { callsTo } = mockRoutes({ 'PUT /projects/p1/repository': {} });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useLinkRepository('p1'), { wrapper });
    const input = { gitlabProjectId: 42, defaultBranch: 'main', testsPath: 'e2e', playwrightConfigPath: 'playwright.config.ts' };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(callsTo('PUT', '/projects/p1/repository')[0].body).toEqual(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });

  it('refreshes the GitLab status when the API says the connection must be renewed', async () => {
    mockRoutes({
      'GET /projects/p1/automation/branches': () =>
        json(403, { statusCode: 403, error: 'Forbidden', message: 'Reconnect GitLab', details: { code: 'GITLAB_NEEDS_RECONNECT' } }),
    });
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAutomationBranches('p1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: gitlabKeys.status });
  });

  it('reads a file at a ref', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/automation/file': fileAt('main', 'x', 'c1') });
    const { result } = renderHook(() => useAutomationFile('p1', 'main', 'e2e/login.spec.ts'), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lastCommitId).toBe('c1');
    expect(callsTo('GET', '/projects/p1/automation/file')[0].query).toEqual({ ref: 'main', path: 'e2e/login.spec.ts' });
  });

  it('saves a file to the work branch and caches the saved version there', async () => {
    const saved = { branch: 'tests/amina-login-fixes', commitId: 'c2', mergeRequest };
    const { callsTo } = mockRoutes({ 'PUT /projects/p1/automation/file': saved });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveAutomationFile('p1'), { wrapper });
    const input = { path: 'e2e/login.spec.ts', content: 'test()', lastCommitId: 'c1', branchSlug: 'login-fixes' };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toEqual(saved);
    });
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toEqual(input);
    expect(queryClient.getQueryData(automationKeys.file('p1', 'tests/amina-login-fixes', 'e2e/login.spec.ts'))).toEqual({
      path: 'e2e/login.spec.ts',
      ref: 'tests/amina-login-fixes',
      content: 'test()',
      lastCommitId: 'c2',
      size: 6,
      readOnly: false,
    });
  });

  it('starts an automated run with a branch and scope', async () => {
    const { callsTo } = mockRoutes({ 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const { result } = renderHook(() => useRunAutomated('p1'), { wrapper: createWrapper().wrapper });
    const input = { branch: 'main', scope: { mode: 'CASES' as const, caseIds: ['c1'] } };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toEqual({ id: 'run9' });
    });
    expect(callsTo('POST', '/projects/p1/runs/automated')[0].body).toEqual(input);
  });

  it('returns the YAML of the CI snippet', async () => {
    const yaml = 'ejad-playwright:\n  image: mcr.microsoft.com/playwright:v1.47.0-jammy\n';
    mockRoutes({ 'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml } });
    const { result } = renderHook(() => useCiSnippet('p1'), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.data).toBe(yaml));
  });

  it('creates a test case from an unlinked result', async () => {
    const created = { testCase: { id: 'c9', code: 'TC-CHK-001' }, resultId: 'r1', tag: '@TC-CHK-001' };
    const { callsTo } = mockRoutes({ 'POST /runs/run1/results/r1/create-case': created });
    const { result } = renderHook(() => useCreateCaseFromResult('run1', 'p1'), { wrapper: createWrapper().wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ resultId: 'r1', input: { name: 'Pay with card', moduleId: 'm2' } })).resolves.toEqual(created);
    });
    expect(callsTo('POST', '/runs/run1/results/r1/create-case')[0].body).toEqual({ name: 'Pay with card', moduleId: 'm2' });
  });
});
```

Run: `npm test -- gitlab/api`
Expected: FAIL with "Failed to resolve import './api'".

- [ ] **Step 7: Implement the hooks**

`src/features/gitlab/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { caseKeys } from '@/features/cases/api';
import { projectKeys } from '@/features/projects/api';
import { runKeys } from '@/features/runs/api';
import { api, ApiError } from '@/lib/api';
import type {
  AutomatedRunInput,
  AutomationBranches,
  AutomationFile,
  AutomationTree,
  CiSnippetResponse,
  CoverageReport,
  CreateCaseFromResultInput,
  CreateCaseFromResultResponse,
  GitlabProjectOption,
  GitlabStatus,
  RepositoryInput,
  RepositoryLink,
  RunDetail,
  SaveFileInput,
  SaveFileResult,
} from '@/lib/types';
import { byteLength } from './paths';

export const gitlabKeys = {
  status: ['gitlab', 'status'] as const,
  projects: (search: string) => ['gitlab', 'projects', search] as const,
};

export const automationKeys = {
  all: (projectId: string) => ['automation', projectId] as const,
  branches: (projectId: string) => ['automation', projectId, 'branches'] as const,
  trees: (projectId: string) => ['automation', projectId, 'tree'] as const,
  tree: (projectId: string, ref: string) => ['automation', projectId, 'tree', ref] as const,
  file: (projectId: string, ref: string, path: string) => ['automation', projectId, 'file', ref, path] as const,
  coverages: (projectId: string) => ['automation', projectId, 'coverage'] as const,
  coverage: (projectId: string, ref: string) => ['automation', projectId, 'coverage', ref] as const,
  ciSnippet: (projectId: string) => ['automation', projectId, 'ci-snippet'] as const,
};

const DISABLED: GitlabStatus = { enabled: false, connection: null };

/** The API answers 403 with details.code GITLAB_NOT_CONNECTED / GITLAB_NEEDS_RECONNECT when the user's GitLab connection is gone. */
export function isConnectionError(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 403) return false;
  const code = (e.body.details as { code?: unknown } | undefined)?.code;
  return code === 'GITLAB_NOT_CONNECTED' || code === 'GITLAB_NEEDS_RECONNECT';
}

/** Refetches the GitLab status after a connection error, so the UI switches to "Connect/Reconnect GitLab" (spec §4). */
function useRefreshStatusOnConnectionError() {
  const queryClient = useQueryClient();
  return (e: unknown) => {
    if (isConnectionError(e)) void queryClient.invalidateQueries({ queryKey: gitlabKeys.status });
  };
}

export function useGitlabStatus() {
  return useQuery({
    queryKey: gitlabKeys.status,
    queryFn: async () => {
      try {
        return await api<GitlabStatus>('/gitlab/status');
      } catch (e) {
        // Without GITLAB_URL the API hides its GitLab endpoints (spec §3): same as "disabled".
        if (e instanceof ApiError && e.status === 404) return DISABLED;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useStartGitlabConnect() {
  return useMutation({ mutationFn: () => api<{ authorizeUrl: string }>('/gitlab/oauth/start') });
}

export function useDisconnectGitlab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/gitlab/connection', { method: 'DELETE' }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['automation'] });
      await queryClient.invalidateQueries({ queryKey: ['gitlab'] });
    },
  });
}

/** Admin search for linking (GET /gitlab/projects?search=). Waits for at least two characters. */
export function useGitlabProjects(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: gitlabKeys.projects(term),
    queryFn: () => api<GitlabProjectOption[]>('/gitlab/projects', { query: { search: term } }),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
}

function useInvalidateRepository(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      queryClient.invalidateQueries({ queryKey: automationKeys.all(projectId) }),
    ]);
}

export function useLinkRepository(projectId: string) {
  const invalidate = useInvalidateRepository(projectId);
  return useMutation({
    mutationFn: (input: RepositoryInput) => api<RepositoryLink>(`/projects/${projectId}/repository`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  });
}

export function useUnlinkRepository(projectId: string) {
  const invalidate = useInvalidateRepository(projectId);
  return useMutation({
    mutationFn: () => api<void>(`/projects/${projectId}/repository`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useAutomationBranches(projectId: string, enabled = true) {
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useQuery({
    queryKey: automationKeys.branches(projectId),
    // The Automation tab's first request: if the GitLab connection is gone, it notices here.
    queryFn: async () => {
      try {
        return await api<AutomationBranches>(`/projects/${projectId}/automation/branches`);
      } catch (e) {
        onConnectionError(e);
        throw e;
      }
    },
    enabled: enabled && !!projectId,
  });
}

export function useAutomationTree(projectId: string, ref: string) {
  return useQuery({
    queryKey: automationKeys.tree(projectId, ref),
    queryFn: () => api<AutomationTree>(`/projects/${projectId}/automation/tree`, { query: { ref } }),
    enabled: !!projectId && !!ref,
  });
}

export function useAutomationFile(projectId: string, ref: string, path: string | null) {
  return useQuery({
    queryKey: automationKeys.file(projectId, ref, path ?? ''),
    queryFn: () => api<AutomationFile>(`/projects/${projectId}/automation/file`, { query: { ref, path } }),
    enabled: !!projectId && !!ref && !!path,
    // The editor keeps its own copy while the user types. Refetch on request (Reload), not on window focus.
    refetchOnWindowFocus: false,
  });
}

/** Commits one file to the user's work branch and opens/updates its merge request (spec §6). */
export function useSaveAutomationFile(projectId: string) {
  const queryClient = useQueryClient();
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useMutation({
    mutationFn: (input: SaveFileInput) =>
      api<SaveFileResult>(`/projects/${projectId}/automation/file`, { method: 'PUT', body: input }),
    onError: onConnectionError,
    onSuccess: (result, input) => {
      // The saved text is now this file's content on the work branch. Seed it so opening it there needs no fetch.
      queryClient.setQueryData<AutomationFile>(automationKeys.file(projectId, result.branch, input.path), {
        path: input.path,
        ref: result.branch,
        content: input.content,
        lastCommitId: result.commitId,
        size: byteLength(input.content),
        readOnly: false,
      });
      void queryClient.invalidateQueries({ queryKey: automationKeys.branches(projectId) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.tree(projectId, result.branch) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.coverages(projectId) });
    },
  });
}

export function useCoverage(projectId: string, ref: string) {
  return useQuery({
    queryKey: automationKeys.coverage(projectId, ref),
    queryFn: () => api<CoverageReport>(`/projects/${projectId}/automation/coverage`, { query: { ref } }),
    enabled: !!projectId && !!ref,
  });
}

/** The provided CI job (spec §7) for this project's Playwright config. The data is the YAML text. */
export function useCiSnippet(projectId: string) {
  return useQuery({
    queryKey: automationKeys.ciSnippet(projectId),
    queryFn: () => api<CiSnippetResponse>(`/projects/${projectId}/automation/ci-snippet`),
    select: (data) => data.yaml,
    enabled: !!projectId,
    staleTime: Infinity,
  });
}

/** Creates an AUTOMATED run and triggers its GitLab pipeline as the current user (spec §7). */
export function useRunAutomated(projectId: string) {
  const queryClient = useQueryClient();
  const onConnectionError = useRefreshStatusOnConnectionError();
  return useMutation({
    mutationFn: (input: AutomatedRunInput) => api<RunDetail>(`/projects/${projectId}/runs/automated`, { method: 'POST', body: input }),
    onError: onConnectionError,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
      ]),
  });
}

/** Turns an Unlinked automated result into a new test case (spec §7). */
export function useCreateCaseFromResult(runId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, input }: { resultId: string; input: CreateCaseFromResultInput }) =>
      api<CreateCaseFromResultResponse>(`/runs/${runId}/results/${resultId}/create-case`, { method: 'POST', body: input }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) }),
        queryClient.invalidateQueries({ queryKey: runKeys.list(projectId) }),
        queryClient.invalidateQueries({ queryKey: caseKeys.all(projectId) }),
        queryClient.invalidateQueries({ queryKey: caseKeys.modules(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: automationKeys.coverages(projectId) }),
      ]),
  });
}
```

- [ ] **Step 8: Verify**

Run: `npm test && npm run typecheck`
Expected: 71 tests pass (51 + paths 7 + access 2 + api 11), and typecheck is clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: GitLab types, API hooks and path helpers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Profile GitLab card, Settings → Repository, project header link and tab

**Files:**
- Create: `src/features/gitlab/gitlab-card.tsx`, `src/features/gitlab/repository-settings.tsx`
- Modify: `src/app/(app)/profile/page.tsx`, `src/app/(app)/projects/[key]/settings/page.tsx`, `src/app/(app)/projects/[key]/layout.tsx`
- Test: `src/features/gitlab/gitlab-card.test.tsx`, `src/features/gitlab/repository-settings.test.tsx`

**Interfaces:**
- Consumes: `useGitlabStatus`, `useStartGitlabConnect`, `useDisconnectGitlab`, `useGitlabProjects`, `useLinkRepository`, `useUnlinkRepository`, `gitlabKeys`, `repositoryOf`, `automationAccess`, `normalizeFolder`, `testsFolderError`, `goTo` (Task 1); `ConfirmDialog`, `Button`, `Input`, `Label` (Phase 1); `useAuth().isAdmin`. API: `GET /gitlab/status`, `GET /gitlab/oauth/start`, `DELETE /gitlab/connection`, `GET /gitlab/projects?search=`, `PUT/DELETE /projects/:id/repository`. The OAuth callback returns to `/profile?gitlab=connected`.
- Produces:
  - `<GitlabCard />`: Connect / Reconnect / Disconnect with the username and avatar. Renders nothing when GitLab is disabled. Handles `?gitlab=connected` (toast "GitLab connected") and any other `?gitlab=` value (error toast), then removes the query.
  - `<RepositorySettings project />` (admins): GitLab project search (debounced 300 ms, ≥ 2 characters), default branch, tests folder and Playwright config path, then Link / Save / Unlink. Renders nothing when GitLab is disabled.
  - The project layout shows the repo link (`gitlabPath` → `gitlabWebUrl`) and an **Automation** tab (`/projects/{KEY}/automation`, placed after Runs) only when `automationAccess(...)` is not `hidden`.

- [ ] **Step 1: Write the failing Profile card tests**

`src/features/gitlab/gitlab-card.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goTo } from '@/lib/navigate';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { GitlabCard } from './gitlab-card';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/profile',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/navigate', () => ({ goTo: vi.fn() }));

describe('GitlabCard', () => {
  beforeEach(() => {
    nav.search = '';
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders nothing when GitLab is disabled', async () => {
    const { callsTo } = mockRoutes({ 'GET /gitlab/status': { enabled: false, connection: null } });
    const { container } = renderWithClient(<GitlabCard />);
    await waitFor(() => expect(callsTo('GET', '/gitlab/status')).toHaveLength(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('heading', { name: 'GitLab' })).not.toBeInTheDocument();
  });

  it('sends the user to GitLab to connect', async () => {
    mockRoutes({
      'GET /gitlab/status': { enabled: true, connection: null },
      'GET /gitlab/oauth/start': { authorizeUrl: 'https://git.ejad.net/oauth/authorize?state=s1' },
    });
    const user = userEvent.setup();
    renderWithClient(<GitlabCard />);
    await user.click(await screen.findByRole('button', { name: 'Connect GitLab' }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('https://git.ejad.net/oauth/authorize?state=s1'));
  });

  it('asks to reconnect when the connection needs it', async () => {
    mockRoutes({
      'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'NEEDS_RECONNECT', avatarUrl: null } },
    });
    renderWithClient(<GitlabCard />);
    expect(await screen.findByText('@amina')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reconnect to keep using automation');
    expect(screen.getByRole('button', { name: 'Reconnect GitLab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('confirms a finished connection and clears the query string', async () => {
    nav.search = 'gitlab=connected';
    mockRoutes({ 'GET /gitlab/status': { enabled: true, connection: { username: 'amina', state: 'ACTIVE' } } });
    renderWithClient(<GitlabCard />);
    expect(await screen.findByText('@amina')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('GitLab connected');
    expect(nav.replace).toHaveBeenCalledWith('/profile');
  });
});
```

Run: `npm test -- gitlab-card`
Expected: FAIL with "Failed to resolve import './gitlab-card'".

- [ ] **Step 2: Implement the Profile card**

`src/features/gitlab/gitlab-card.tsx`:
```tsx
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Unplug } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { goTo } from '@/lib/navigate';
import { gitlabKeys, useDisconnectGitlab, useGitlabStatus, useStartGitlabConnect } from './api';

/** Profile → GitLab (spec §4, §10). Must render inside <Suspense> because it reads the search params. */
export function GitlabCard() {
  const status = useGitlabStatus();
  const start = useStartGitlabConnect();
  const disconnect = useDisconnectGitlab();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const outcome = useSearchParams().get('gitlab');
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  // The OAuth callback redirects to /profile?gitlab=connected. Confirm it once, refresh the status and drop the query.
  useEffect(() => {
    if (!outcome || handled.current) return;
    handled.current = true;
    if (outcome === 'connected') toast.success('GitLab connected');
    else toast.error('GitLab could not be connected. Please try again.');
    void queryClient.invalidateQueries({ queryKey: gitlabKeys.status });
    router.replace(pathname);
  }, [outcome, queryClient, router, pathname]);

  async function connect() {
    try {
      const { authorizeUrl } = await start.mutateAsync();
      goTo(authorizeUrl);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not start the GitLab connection');
    }
  }

  async function confirmDisconnect() {
    try {
      await disconnect.mutateAsync();
      toast.success('GitLab disconnected');
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not disconnect GitLab');
    }
  }

  if (!status.data?.enabled) return null;
  const connection = status.data.connection;
  const needsReconnect = connection?.state === 'NEEDS_RECONNECT';

  return (
    <section aria-labelledby="gitlab-heading" className="rounded-xl border bg-card p-5">
      <h2 id="gitlab-heading" className="font-medium">
        GitLab
      </h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-muted-foreground">
        Connect your company GitLab account to view, edit and run a project&apos;s automated tests. Everything the tool does in
        GitLab for you uses your own account and permissions.
      </p>
      {!connection ? (
        <Button onClick={() => void connect()} disabled={start.isPending}>
          {start.isPending ? 'Opening GitLab…' : 'Connect GitLab'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {connection.avatarUrl ? (
              // The avatar comes from the GitLab host, so next/image would need its domain configured.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={connection.avatarUrl} alt="" className="h-9 w-9 rounded-full border" />
            ) : (
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-medium">
                {connection.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-medium">@{connection.username}</p>
              <p className="text-xs text-muted-foreground">{needsReconnect ? 'Needs reconnect' : 'Connected'}</p>
            </div>
          </div>
          {needsReconnect && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Your GitLab sign-in expired or was revoked. Reconnect to keep using automation.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {needsReconnect && (
              <Button onClick={() => void connect()} disabled={start.isPending}>
                <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
                Reconnect GitLab
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <Unplug className="mr-1.5 h-4 w-4" aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect GitLab?"
        description="The tool stops using your GitLab account. Your work branches and merge requests stay in GitLab."
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={() => void confirmDisconnect()}
      />
    </section>
  );
}
```

Run: `npm test -- gitlab-card`
Expected: 4 tests pass.

- [ ] **Step 3: Write the failing repository settings tests**

`src/features/gitlab/repository-settings.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { linkedProject, unlinkedProject } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { RepositorySettings } from './repository-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const active = { enabled: true, connection: { username: 'admin', state: 'ACTIVE' } };

describe('RepositorySettings', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('searches GitLab and links the chosen project with its tests folder', async () => {
    const { callsTo } = mockRoutes({
      'GET /gitlab/status': active,
      'GET /gitlab/projects': [
        {
          id: 42,
          name: 'Ninja Store',
          pathWithNamespace: 'mobile/ninja-store',
          webUrl: 'https://git.ejad.net/mobile/ninja-store',
          defaultBranch: 'develop',
        },
      ],
      'PUT /projects/p1/repository': {},
    });
    const user = userEvent.setup();
    renderWithClient(<RepositorySettings project={unlinkedProject} />);

    await user.type(await screen.findByLabelText('GitLab project'), 'ninja');
    await user.click(await screen.findByRole('button', { name: /mobile\/ninja-store/ }));
    expect(screen.getByLabelText('Default branch')).toHaveValue('develop');
    await user.type(screen.getByLabelText('Tests folder'), '/e2e/');
    await user.click(screen.getByRole('button', { name: 'Link repository' }));

    await waitFor(() => expect(callsTo('PUT', '/projects/p1/repository')).toHaveLength(1));
    expect(callsTo('PUT', '/projects/p1/repository')[0].body).toEqual({
      gitlabProjectId: 42,
      defaultBranch: 'develop',
      testsPath: 'e2e',
      playwrightConfigPath: 'playwright.config.ts',
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Repository linked'));
  });

  it('asks the admin to connect GitLab before searching', async () => {
    mockRoutes({ 'GET /gitlab/status': { enabled: true, connection: null } });
    renderWithClient(<RepositorySettings project={unlinkedProject} />);
    expect(await screen.findByText(/Connect your GitLab account to search repositories/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByLabelText('GitLab project')).not.toBeInTheDocument();
  });

  it('unlinks a linked repository after confirming', async () => {
    const { callsTo } = mockRoutes({
      'GET /gitlab/status': active,
      'DELETE /projects/p1/repository': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    renderWithClient(<RepositorySettings project={linkedProject} />);

    expect(await screen.findByRole('link', { name: /mobile\/ninja-store/ })).toHaveAttribute('href', 'https://git.ejad.net/mobile/ninja-store');
    await user.click(screen.getByRole('button', { name: 'Unlink repository' }));
    await user.click(await screen.findByRole('button', { name: 'Unlink' }));

    await waitFor(() => expect(callsTo('DELETE', '/projects/p1/repository')).toHaveLength(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Repository unlinked'));
  });
});
```

Run: `npm test -- repository-settings`
Expected: FAIL with "Failed to resolve import './repository-settings'".

- [ ] **Step 4: Implement Settings → Repository**

`src/features/gitlab/repository-settings.tsx`:
```tsx
'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { GitlabProjectOption, ProjectDetail, RepositoryLink } from '@/lib/types';
import { repositoryOf } from './access';
import { useGitlabProjects, useGitlabStatus, useLinkRepository, useUnlinkRepository } from './api';
import { normalizeFolder, testsFolderError } from './paths';

type ChosenProject = Pick<RepositoryLink, 'gitlabProjectId' | 'gitlabPath' | 'gitlabWebUrl'>;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Project Settings → Repository (admins only, GitLab spec §5). Renders nothing while GitLab is disabled. */
export function RepositorySettings({ project }: { project: ProjectDetail }) {
  const status = useGitlabStatus();
  const unlink = useUnlinkRepository(project.id);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  if (!status.data?.enabled) return null;
  const repo = repositoryOf(project);
  const connection = status.data.connection;

  async function confirmUnlink() {
    try {
      await unlink.mutateAsync();
      toast.success('Repository unlinked');
      setUnlinkOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not unlink the repository');
    }
  }

  return (
    <section aria-labelledby="repository-heading" className="max-w-xl space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h3 id="repository-heading" className="font-medium">
          Repository
        </h3>
        <p className="text-sm text-muted-foreground">
          Link this project to its GitLab repository. Its automated tests then appear on an Automation tab, and testers can run them in GitLab CI.
        </p>
      </div>
      {repo && (
        <p className="text-sm">
          Linked to{' '}
          <a href={repo.gitlabWebUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
            {repo.gitlabPath}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </p>
      )}
      {connection?.state === 'ACTIVE' ? (
        <RepositoryForm project={project} repo={repo} />
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {connection ? 'Your GitLab connection needs to be renewed before you can change the link.' : 'Connect your GitLab account to search repositories.'}{' '}
          <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
            Go to Profile
          </Link>
        </p>
      )}
      {repo && (
        <div className="border-t pt-4">
          <Button variant="outline" onClick={() => setUnlinkOpen(true)}>
            Unlink repository
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title={`Unlink ${repo?.gitlabPath ?? 'the repository'}?`}
        description="The Automation tab goes away. Existing runs keep their history, and nothing changes in GitLab."
        confirmLabel="Unlink"
        destructive
        pending={unlink.isPending}
        onConfirm={() => void confirmUnlink()}
      />
    </section>
  );
}

function RepositoryForm({ project, repo }: { project: ProjectDetail; repo: RepositoryLink | null }) {
  const link = useLinkRepository(project.id);
  const [chosen, setChosen] = useState<ChosenProject | null>(
    repo ? { gitlabProjectId: repo.gitlabProjectId, gitlabPath: repo.gitlabPath, gitlabWebUrl: repo.gitlabWebUrl } : null,
  );
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const results = useGitlabProjects(chosen ? '' : term);
  const [defaultBranch, setDefaultBranch] = useState(repo?.defaultBranch ?? '');
  const [testsPath, setTestsPath] = useState(repo?.testsPath ?? '');
  const [configPath, setConfigPath] = useState(repo?.playwrightConfigPath ?? 'playwright.config.ts');

  const folderError = testsPath.trim() ? testsFolderError(testsPath) : null;
  const configError = configPath.split('/').includes('..') ? 'Use a path inside the repository (no "..")' : null;
  const canSave =
    !!chosen && !!defaultBranch.trim() && !!testsPath.trim() && !folderError && !!configPath.trim() && !configError && !link.isPending;

  function choose(option: GitlabProjectOption) {
    setChosen({ gitlabProjectId: option.id, gitlabPath: option.pathWithNamespace, gitlabWebUrl: option.webUrl });
    setDefaultBranch(option.defaultBranch ?? 'main');
    setSearch('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen || !canSave) return;
    try {
      await link.mutateAsync({
        gitlabProjectId: chosen.gitlabProjectId,
        defaultBranch: defaultBranch.trim(),
        testsPath: normalizeFolder(testsPath),
        playwrightConfigPath: configPath.trim(),
      });
      toast.success(repo ? 'Repository settings saved' : 'Repository linked');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not link the repository');
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {chosen ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="min-w-0 truncate font-mono text-sm">{chosen.gitlabPath}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="repo-search">GitLab project</Label>
          <Input
            id="repo-search"
            type="search"
            placeholder="Search your GitLab projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {term.length >= 2 &&
            (results.isPending ? (
              <p className="text-xs text-muted-foreground">Searching…</p>
            ) : results.isError ? (
              <p className="text-xs text-destructive">{results.error.message}</p>
            ) : results.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">No projects match “{term}”.</p>
            ) : (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {results.data.map((option) => (
                  <li key={option.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => choose(option)}>
                      <span className="block font-mono text-sm">{option.pathWithNamespace}</span>
                      <span className="block text-xs text-muted-foreground">
                        {option.name}
                        {option.defaultBranch && ` · default branch ${option.defaultBranch}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="repo-branch">Default branch</Label>
          <Input id="repo-branch" className="font-mono" placeholder="main" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repo-tests">Tests folder</Label>
          <Input
            id="repo-tests"
            className="font-mono"
            placeholder="e2e"
            value={testsPath}
            aria-invalid={!!folderError}
            onChange={(e) => setTestsPath(e.target.value)}
          />
          {folderError && <p className="text-xs text-destructive">{folderError}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="repo-config">Playwright config</Label>
        <Input id="repo-config" className="font-mono" value={configPath} aria-invalid={!!configError} onChange={(e) => setConfigPath(e.target.value)} />
        {configError && <p className="text-xs text-destructive">{configError}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Testers can edit files only inside the tests folder. Every save goes to their own branch with a merge request, never to the default branch.
      </p>
      <Button type="submit" disabled={!canSave}>
        {link.isPending ? 'Saving…' : repo ? 'Save repository settings' : 'Link repository'}
      </Button>
    </form>
  );
}
```

Run: `npm test -- repository-settings`
Expected: 3 tests pass.

- [ ] **Step 5: Wire the card, the settings section, the header link and the tab**

`src/app/(app)/profile/page.tsx`:
```tsx
'use client';

import { Suspense } from 'react';
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
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-medium">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
```

In `src/app/(app)/projects/[key]/settings/page.tsx`, add `import { RepositorySettings } from '@/features/gitlab/repository-settings';`, then replace the admin return (`return <ProjectSettingsForm key={project.data.id + project.data.name} project={project.data} />;`) with:
```tsx
  return (
    <div className="space-y-6">
      <ProjectSettingsForm key={project.data.id + project.data.name} project={project.data} />
      {/* Admins only (GitLab spec §5). Re-keyed so the form starts from the new link after linking or unlinking. */}
      <RepositorySettings key={`${project.data.id}:${project.data.gitlabProjectId ?? 'none'}`} project={project.data} />
    </div>
  );
```
The non-admin branch stays as it is, so testers never see Settings → Repository.

`src/app/(app)/projects/[key]/layout.tsx`:
```tsx
'use client';

import { ExternalLink, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const TABS = [
  { segment: 'cases', label: 'Test Cases' },
  { segment: 'runs', label: 'Runs' },
  { segment: 'dashboard', label: 'Dashboard' },
  { segment: 'settings', label: 'Settings' },
];
const AUTOMATION_TAB = { segment: 'automation', label: 'Automation' };

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: { key: string } }) {
  const project = useProject(params.key);
  const gitlab = useGitlabStatus();
  const pathname = usePathname();

  if (project.isPending) return <LoadingState />;
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.status === 404) {
      return (
        <div className="py-16 text-center">
          <p className="font-medium">Project not found</p>
          <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to projects
          </Link>
        </div>
      );
    }
    return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  }

  // GitLab UI appears only while GitLab is enabled and the project is linked (spec §10).
  const access = automationAccess(gitlab.data, project.data);
  const repo = access.state === 'hidden' ? null : access.repo;
  const tabs = repo ? [...TABS.slice(0, 2), AUTOMATION_TAB, ...TABS.slice(2)] : TABS;
  const base = `/projects/${project.data.key}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.data.name}</h1>
          <Badge variant="outline" className="font-mono">
            {project.data.key}
          </Badge>
          {project.data.archivedAt && <Badge variant="secondary">Archived</Badge>}
          {repo && (
            <a
              href={repo.gitlabWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <GitBranch className="h-4 w-4" aria-hidden />
              <span className="font-mono">{repo.gitlabPath}</span>
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="sr-only">(opens GitLab)</span>
            </a>
          )}
        </div>
        {project.data.description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{project.data.description}</p>}
      </div>
      <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.segment}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 78 tests pass (71 + card 4 + settings 3), and typecheck, lint and build succeed. If the API is running with GitLab configured, smoke-check this flow:
1. Profile shows the GitLab card. Connect goes to GitLab and back to `/profile?gitlab=connected`, which shows the "GitLab connected" toast and `@username`, and the query disappears.
2. As admin, Settings → Repository: search, pick a project, and set the tests folder `e2e`. After Link, the header shows the repo link and an Automation tab appears (a 404 page until Task 3).
3. As a tester, Settings shows no Repository section.
4. Without `GITLAB_URL` on the API, none of this appears.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: GitLab connection card, repository settings and project repo link

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Automation tab: route, branch selector and file tree

**Files:**
- Create: `src/features/automation/file-tree.ts`, `src/features/automation/file-tree-view.tsx`, `src/features/automation/branch-select.tsx`, `src/features/automation/merge-request-link.tsx`, `src/features/automation/automation-view.tsx`, `src/app/(app)/projects/[key]/automation/page.tsx`
- Test: `src/features/automation/file-tree.test.ts`, `src/features/automation/automation-view.test.tsx`

**Interfaces:**
- Consumes: `useProject`; `useGitlabStatus`, `useAutomationBranches`, `useAutomationTree`, `automationAccess`, `initialBranch`, `normalizeFolder` (Task 1); `EmptyState`, `ErrorState`, `LoadingState`. API: `GET /projects/:id/automation/branches`, `GET /projects/:id/automation/tree?ref=`.
- Produces:
  - `interface TreeNode { name; path; type: 'tree' | 'blob'; children: TreeNode[] }`; `buildFileTree(entries, testsPath): TreeNode[]` (only entries inside the tests folder, with missing parent folders added, folders first, then natural-sorted names); `ancestorFolders(path, testsPath): string[]`
  - `<FileTreeView nodes testsPath selectedPath onSelect caseCounts? />`: folders are buttons with `aria-expanded` (top-level folders open by default), and the selected file has `aria-current="true"`
  - `<BranchSelect id? branches value onChange disabled? />`: a native `<select>` labelled "Branch". It keeps `value` as an option even before the branch list is refetched.
  - `<MergeRequestLink mergeRequest />`: link text "Merge request !{iid}" plus a state chip (Open / Merged / Closed / Locked)
  - `<AutomationView project repo username />` (the Task 3 version: toolbar, tree and a file placeholder; Task 4 replaces it)
  - Route `/projects/{KEY}/automation`: shows "Automation isn't set up…" when hidden, "Connect GitLab to use automation" / "Reconnect GitLab" (both link to `/profile`), otherwise `<AutomationView>`

- [ ] **Step 1: Write the failing tree tests**

`src/features/automation/file-tree.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { ancestorFolders, buildFileTree, type TreeNode } from './file-tree';

type Shape = string | { [folder: string]: Shape[] };
const shape = (nodes: TreeNode[]): Shape[] => nodes.map((n) => (n.type === 'tree' ? { [n.name]: shape(n.children) } : n.name));
const blob = (path: string): AutomationTreeEntry => ({ path, name: path.slice(path.lastIndexOf('/') + 1), type: 'blob' });
const tree = (path: string): AutomationTreeEntry => ({ path, name: path.slice(path.lastIndexOf('/') + 1), type: 'tree' });

describe('buildFileTree', () => {
  it('nests entries under the tests folder, folders first, in natural order', () => {
    const nodes = buildFileTree(
      [
        tree('e2e'),
        blob('e2e/home.spec.ts'),
        tree('e2e/auth'),
        blob('e2e/auth/login.spec.ts'),
        blob('e2e/auth/2fa.spec.ts'),
        blob('e2e/auth/10-reset.spec.ts'),
      ],
      'e2e/',
    );
    expect(shape(nodes)).toEqual([{ auth: ['2fa.spec.ts', '10-reset.spec.ts', 'login.spec.ts'] }, 'home.spec.ts']);
    expect(nodes[0].path).toBe('e2e/auth');
    expect(nodes[0].children[2].path).toBe('e2e/auth/login.spec.ts');
  });

  it('adds missing parent folders and ignores files outside the tests folder', () => {
    const nodes = buildFileTree([blob('e2e/checkout/pay.spec.ts'), blob('e2e2/other.spec.ts'), blob('README.md')], 'e2e');
    expect(shape(nodes)).toEqual([{ checkout: ['pay.spec.ts'] }]);
    expect(buildFileTree([], 'e2e')).toEqual([]);
  });

  it('lists the folders to open for a nested file', () => {
    expect(ancestorFolders('e2e/auth/flows/login.spec.ts', 'e2e')).toEqual(['e2e/auth', 'e2e/auth/flows']);
    expect(ancestorFolders('e2e/home.spec.ts', 'e2e')).toEqual([]);
    expect(ancestorFolders('auth/login.spec.ts', '')).toEqual(['auth']);
  });
});
```

Run: `npm test -- file-tree`
Expected: FAIL with "Failed to resolve import './file-tree'".

- [ ] **Step 2: Implement the tree builder**

`src/features/automation/file-tree.ts`:
```ts
import { normalizeFolder } from '@/features/gitlab/paths';
import type { AutomationTreeEntry } from '@/lib/types';

export interface TreeNode {
  name: string;
  /** Repository-relative path (what the file and coverage endpoints use). */
  path: string;
  type: 'tree' | 'blob';
  children: TreeNode[];
}

const parentOf = (path: string) => {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
};

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) =>
    a.type !== b.type ? (a.type === 'tree' ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  nodes.forEach((n) => sortNodes(n.children));
}

/** Nests GitLab's flat recursive tree under `testsPath`. Folders come first, then natural-sorted names. */
export function buildFileTree(entries: AutomationTreeEntry[], testsPath: string): TreeNode[] {
  const root = normalizeFolder(testsPath);
  const prefix = root ? `${root}/` : '';
  const top: TreeNode[] = [];
  const folders = new Map<string, TreeNode>();

  // Returns the children list of the folder at `path`, creating it (and its parents) when missing.
  function childrenOf(path: string): TreeNode[] {
    if (path === root) return top;
    const existing = folders.get(path);
    if (existing) return existing.children;
    const node: TreeNode = { name: path.slice(path.lastIndexOf('/') + 1), path, type: 'tree', children: [] };
    folders.set(path, node);
    childrenOf(parentOf(path)).push(node);
    return node.children;
  }

  for (const entry of entries) {
    const path = normalizeFolder(entry.path);
    if (path === root || !path.startsWith(prefix)) continue;
    if (entry.type === 'tree') {
      childrenOf(path);
    } else {
      childrenOf(parentOf(path)).push({ name: path.slice(path.lastIndexOf('/') + 1), path, type: 'blob', children: [] });
    }
  }
  sortNodes(top);
  return top;
}

/** The folders between the tests folder and `path` that must be open to show it. */
export function ancestorFolders(path: string, testsPath: string): string[] {
  const root = normalizeFolder(testsPath);
  const parts = normalizeFolder(path).split('/');
  const folders: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const folder = parts.slice(0, i).join('/');
    if (root && (folder === root || !folder.startsWith(`${root}/`))) continue;
    folders.push(folder);
  }
  return folders;
}
```

Run: `npm test -- file-tree`
Expected: 3 tests pass.

- [ ] **Step 3: Tree view, branch selector and merge request link**

`src/features/automation/file-tree-view.tsx`:
```tsx
'use client';

import { ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ancestorFolders, type TreeNode } from './file-tree';

interface FileTreeViewProps {
  nodes: TreeNode[];
  testsPath: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** How many test cases each file covers (by repository path), shown as a small count. */
  caseCounts?: Record<string, number>;
}

interface TreeListProps extends Omit<FileTreeViewProps, 'nodes' | 'testsPath'> {
  nodes: TreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function TreeList({ nodes, depth, expanded, onToggle, selectedPath, onSelect, caseCounts }: TreeListProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const indent = { paddingLeft: `${depth * 0.875 + 0.25}rem` };
        if (node.type === 'tree') {
          const open = expanded.has(node.path);
          return (
            <li key={node.path}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggle(node.path)}
                style={indent}
                className="flex w-full items-center gap-1.5 rounded py-1 pr-1 text-left text-sm hover:bg-muted"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
                {open ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-brand-deep" aria-hidden />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-brand-deep" aria-hidden />
                )}
                <span className="truncate">{node.name}</span>
              </button>
              {open && node.children.length > 0 && (
                <TreeList
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  caseCounts={caseCounts}
                />
              )}
            </li>
          );
        }
        const selected = node.path === selectedPath;
        const count = caseCounts?.[node.path] ?? 0;
        return (
          <li key={node.path}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(node.path)}
              style={indent}
              className={cn(
                'flex w-full items-center gap-1.5 rounded py-1 pr-1 text-left text-sm hover:bg-muted',
                selected && 'bg-primary/10 font-medium text-primary hover:bg-primary/15',
              )}
            >
              <span className="w-3.5 shrink-0" aria-hidden />
              <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{node.name}</span>
              {count > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-accent-foreground" title={`Covers ${count} test case${count === 1 ? '' : 's'}`}>
                  <span className="sr-only">covers </span>
                  {count}
                  <span className="sr-only"> test cases</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FileTreeView({ nodes, testsPath, selectedPath, onSelect, caseCounts }: FileTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.type === 'tree').map((n) => n.path)));

  // Keep the selected file visible, e.g. after opening it from the coverage list.
  useEffect(() => {
    if (!selectedPath) return;
    const needed = ancestorFolders(selectedPath, testsPath);
    setExpanded((prev) => (needed.every((p) => prev.has(p)) ? prev : new Set([...prev, ...needed])));
  }, [selectedPath, testsPath]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <nav aria-label="Test files">
      <TreeList nodes={nodes} depth={0} expanded={expanded} onToggle={toggle} selectedPath={selectedPath} onSelect={onSelect} caseCounts={caseCounts} />
    </nav>
  );
}
```

`src/features/automation/branch-select.tsx`:
```tsx
import type { AutomationBranch } from '@/lib/types';

interface BranchSelectProps {
  id?: string;
  branches: AutomationBranch[];
  value: string;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

/** A native select (simple to use and to test). The current value stays listed until the branch list catches up. */
export function BranchSelect({ id = 'automation-branch', branches, value, onChange, disabled }: BranchSelectProps) {
  const options = !value || branches.some((b) => b.name === value) ? branches : [...branches, { name: value, isDefault: false, mergeRequest: null }];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Branch
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 max-w-[20rem] rounded-md border border-input bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {options.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
            {b.isDefault ? ' (default)' : ''}
            {b.mergeRequest ? ` · MR !${b.mergeRequest.iid}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
```

`src/features/automation/merge-request-link.tsx`:
```tsx
import { ExternalLink, GitPullRequest } from 'lucide-react';
import type { MergeRequestRef } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATES: Record<string, { label: string; className: string }> = {
  opened: { label: 'Open', className: 'bg-status-passed/15 text-status-passed-fg' },
  merged: { label: 'Merged', className: 'bg-primary/10 text-primary' },
  closed: { label: 'Closed', className: 'bg-status-skipped/15 text-status-skipped-fg' },
  locked: { label: 'Locked', className: 'bg-status-blocked/20 text-status-blocked-fg' },
};

export function MergeRequestLink({ mergeRequest }: { mergeRequest: MergeRequestRef }) {
  const state = STATES[mergeRequest.state] ?? { label: mergeRequest.state, className: 'bg-muted text-muted-foreground' };
  return (
    <a
      href={mergeRequest.webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <GitPullRequest className="h-4 w-4" aria-hidden />
      Merge request !{mergeRequest.iid}
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium no-underline', state.className)}>{state.label}</span>
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
```

- [ ] **Step 4: Write the failing Automation view tests**

`src/features/automation/automation-view.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { mockRoutes, type MockCall } from '@/test/fetch-routes';
import { branchList, linkedProject, mainBranch, mergeRequest, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AutomationView } from './automation-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const trees: Record<string, AutomationTreeEntry[]> = {
  main: [{ path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' }],
  'tests/amina-login-fixes': [
    { path: 'e2e/auth', name: 'auth', type: 'tree' },
    { path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' },
    { path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' },
  ],
};
const treeRoute = ({ query }: MockCall) => treeAt(query.ref, trees[query.ref] ?? []);

describe('AutomationView', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the user's work branch with its merge request and files", async () => {
    const { callsTo } = mockRoutes({
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    expect(await screen.findByRole('button', { name: /login\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Branch')).toHaveValue('tests/amina-login-fixes');
    expect(screen.getByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(callsTo('GET', '/projects/p1/automation/tree').map((c) => c.query.ref)).toEqual(['tests/amina-login-fixes']);
  });

  it("shows another branch's files after switching branches", async () => {
    mockRoutes({
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await screen.findByRole('button', { name: /login\.spec\.ts/ });
    await user.selectOptions(screen.getByLabelText('Branch'), 'main');

    expect(await screen.findByRole('button', { name: /home\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login\.spec\.ts/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Merge request/ })).not.toBeInTheDocument();
  });
});
```

Run: `npm test -- automation-view`
Expected: FAIL with "Failed to resolve import './automation-view'".

- [ ] **Step 5: Implement the Automation view and route**

`src/features/automation/automation-view.tsx`:
```tsx
'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationBranches, useAutomationTree } from '@/features/gitlab/api';
import { initialBranch, normalizeFolder } from '@/features/gitlab/paths';
import type { ProjectDetail, RepositoryLink } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { buildFileTree } from './file-tree';
import { FileTreeView } from './file-tree-view';
import { MergeRequestLink } from './merge-request-link';

interface AutomationViewProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** The current user's GitLab username (their work branches are tests/<username>-<slug>). */
  username: string;
}

export function AutomationView({ project, repo, username }: AutomationViewProps) {
  const branches = useAutomationBranches(project.id);
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const branch = chosenBranch ?? (branches.data ? initialBranch(branches.data.branches, username, repo.defaultBranch) : '');
  const tree = useAutomationTree(project.id, branch);
  const nodes = useMemo(() => buildFileTree(tree.data?.entries ?? [], repo.testsPath), [tree.data, repo.testsPath]);
  const current = branches.data?.branches.find((b) => b.name === branch);

  if (branches.isPending) return <LoadingState label="Loading branches…" />;
  if (branches.isError) return <ErrorState error={branches.error} onRetry={() => branches.refetch()} />;

  function changeBranch(next: string) {
    setChosenBranch(next);
    setSelectedPath(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <BranchSelect branches={branches.data.branches} value={branch} onChange={changeBranch} />
        {current?.mergeRequest && <MergeRequestLink mergeRequest={current.mergeRequest} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" asChild>
            <a href={repo.gitlabWebUrl} target="_blank" rel="noopener noreferrer">
              Open in GitLab
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Tests folder" className="min-w-0 rounded-xl border bg-card p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tests folder <span className="font-mono normal-case">{normalizeFolder(repo.testsPath)}</span>
          </p>
          {tree.isPending ? (
            <LoadingState label="Loading files…" />
          ) : tree.isError ? (
            <ErrorState error={tree.error} onRetry={() => tree.refetch()} />
          ) : nodes.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">No files in this folder on this branch yet.</p>
          ) : (
            <FileTreeView nodes={nodes} testsPath={repo.testsPath} selectedPath={selectedPath} onSelect={setSelectedPath} />
          )}
        </section>
        <section aria-label="Editor" className="min-w-0 rounded-xl border bg-card p-4">
          {selectedPath ? (
            <p className="font-mono text-sm">{selectedPath}</p>
          ) : (
            <EmptyState title="Select a file" description="Choose a test file on the left to open it." />
          )}
        </section>
      </div>
    </div>
  );
}
```

`src/app/(app)/projects/[key]/automation/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { AutomationView } from '@/features/automation/automation-view';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';

export default function AutomationPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const gitlab = useGitlabStatus();
  if (!project.data) return null;
  if (gitlab.isPending) return <LoadingState />;
  if (gitlab.isError) return <ErrorState error={gitlab.error} onRetry={() => gitlab.refetch()} />;

  const access = automationAccess(gitlab.data, project.data);
  switch (access.state) {
    case 'hidden':
      return (
        <EmptyState
          title="Automation isn't set up for this project"
          description="An admin can link the project's GitLab repository in Settings → Repository."
        />
      );
    case 'connect':
      return (
        <EmptyState
          title="Connect GitLab to use automation"
          description="Automation uses your own GitLab account, so your GitLab permissions apply."
          action={
            <Button asChild>
              <Link href="/profile">Connect GitLab</Link>
            </Button>
          }
        />
      );
    case 'reconnect':
      return (
        <EmptyState
          title="Reconnect GitLab"
          description="Your GitLab sign-in expired or was revoked. Reconnect it on your Profile to keep using automation."
          action={
            <Button asChild>
              <Link href="/profile">Reconnect GitLab</Link>
            </Button>
          }
        />
      );
    default:
      return <AutomationView project={project.data} repo={access.repo} username={access.username} />;
  }
}
```

Run: `npm test -- automation-view file-tree`
Expected: 5 tests pass.

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 83 tests pass (78 + tree 3 + view 2), and typecheck, lint and build succeed. If the API is running with a linked project, smoke-check this flow: the Automation tab opens on your work branch (or the default branch), shows the tests folder tree, and switching branches reloads the tree. Disconnecting GitLab on Profile turns the tab into "Connect GitLab to use automation".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Automation tab with branch selector and tests folder tree

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Monaco editor and the save flow (work branch + merge request)

**Files:**
- Create: `scripts/copy-monaco.mjs`, `src/features/automation/code-editor.tsx`, `src/test/code-editor-mock.tsx`, `src/features/automation/work-name-dialog.tsx`, `src/features/automation/new-file-dialog.tsx`, `src/features/automation/editor-panel.tsx`
- Modify: `package.json` (dependencies and `predev`/`prebuild`), `.gitignore`, `src/features/automation/automation-view.tsx` (replace), `src/features/automation/automation-view.test.tsx` (replace)
- Test: `src/features/automation/editor-panel.test.tsx`, `src/features/automation/automation-view.test.tsx`

**Interfaces:**
- Consumes: `useAutomationFile`, `useSaveAutomationFile`, `slugify`, `workBranchName`, `slugFromWorkBranch`, `languageFor`, `MAX_EDITABLE_BYTES`, `byteLength`, `newFilePathError`, `joinPath`, `normalizeFolder` (Task 1); `BranchSelect`, `FileTreeView`, `MergeRequestLink`, `buildFileTree` (Task 3); `ConfirmDialog`. API: `GET /projects/:id/automation/file?ref=&path=` → `{ path, ref, content, lastCommitId, size, readOnly }`; `PUT /projects/:id/automation/file { path, content, lastCommitId?, branchSlug }` → `{ branch, commitId, mergeRequest }`. Errors: 409 `This file changed on the branch – reload it before saving`, 409 `A file with this path already exists – open it before saving` (new file), 413 `Files larger than 1 MB are read-only`, and 400 for path rules.
- Produces:
  - `interface CodeEditorProps { value; language; readOnly; onChange(value) }`; `<CodeEditor />`: Monaco through `next/dynamic` (`ssr: false`), loaded from `/monaco/vs`, with TypeScript semantic diagnostics off (the repo's types aren't in the browser)
  - `<WorkNameDialog open onOpenChange username pending onConfirm(slug) />`: previews `tests/<username>-<slug>`. Its submit button is "Save to my branch".
  - `<NewFileDialog testsPath existing onCreate(path) />`: validates the path relative to the tests folder and rejects paths that already exist
  - `NEW_FILE_TEMPLATE`; `<EditorPanel projectId branch path isNew username onSaved(result) onDirtyChange(dirty) />`. On a work branch, Save commits straight away. Otherwise it asks for a work name first. A 409 shows the API's message with "Copy my changes" and "Reload" (no Reload for a new file). Other errors, such as 413 and 400, show a toast. Files flagged `readOnly` (over 1 MB) are read-only.
  - `<AutomationView />` (final shape): the toolbar shows the MR link for the selected branch (or for the branch just saved), and has New file and Open in GitLab. After the first save it switches to the work branch. Switching file or branch with unsaved changes asks "Discard unsaved changes?", and so does leaving the page (`beforeunload`).

- [ ] **Step 1: Install Monaco and serve it from the app**

```bash
cd /c/Users/User/StudioProjects/ejad-testcases-web
npm install @monaco-editor/react@4.7.0 monaco-editor@0.52.2
```

`scripts/copy-monaco.mjs`:
```js
// Copies Monaco's AMD build into public/monaco/vs so the editor loads from this site (no CDN and no
// third-party script origin to allow in a Content-Security-Policy). Runs before `dev` and `build`.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const target = join(root, 'public', 'monaco', 'vs');

if (!existsSync(source)) {
  console.error('monaco-editor is not installed. Run npm install first.');
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log('Copied Monaco editor to public/monaco/vs');
```

In `package.json`, add two scripts next to the existing ones (keep the others as they are):
```json
    "predev": "node scripts/copy-monaco.mjs",
    "prebuild": "node scripts/copy-monaco.mjs",
```

Append to `.gitignore`:
```
# Monaco editor, copied from node_modules by scripts/copy-monaco.mjs
/public/monaco
```

Run: `node scripts/copy-monaco.mjs && ls public/monaco/vs/loader.js`
Expected: `Copied Monaco editor to public/monaco/vs`, and the file exists.

If `next.config.mjs` now sends a `Content-Security-Policy` header (from the fix wave), make sure it allows Monaco: `script-src 'self'`, `worker-src 'self' blob:`, `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`. Add only the directives that are missing. Otherwise leave the file alone.

- [ ] **Step 2: The editor wrapper and its test stand-in**

`src/features/automation/code-editor.tsx`:
```tsx
'use client';

import type { Monaco } from '@monaco-editor/react';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/page-state';

export interface CodeEditorProps {
  value: string;
  language: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

// Monaco needs `window`, so it loads only in the browser. It is served from /monaco/vs (see scripts/copy-monaco.mjs).
const MonacoEditor = dynamic(
  async () => {
    const { default: Editor, loader } = await import('@monaco-editor/react');
    loader.config({ paths: { vs: '/monaco/vs' } });
    return Editor;
  },
  { ssr: false, loading: () => <LoadingState label="Loading editor…" /> },
);

// The repository's own types (e.g. @playwright/test) aren't available in the browser, so show syntax errors only.
function configureTypeScript(monaco: Monaco) {
  const options = { noSemanticValidation: true, noSyntaxValidation: false };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(options);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(options);
}

export function CodeEditor({ value, language, readOnly, onChange }: CodeEditorProps) {
  return (
    <div className="h-[60vh] min-h-[320px] overflow-hidden rounded-md border">
      <MonacoEditor
        height="100%"
        value={value}
        language={language}
        theme="vs"
        beforeMount={configureTypeScript}
        onChange={(next) => onChange(next ?? '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontFamily: 'var(--font-mono), ui-monospace, monospace',
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
```

`src/test/code-editor-mock.tsx`:
```tsx
import type { CodeEditorProps } from '@/features/automation/code-editor';

/** Stand-in for Monaco in component tests: `vi.mock('./code-editor', () => import('@/test/code-editor-mock'))`. */
export function CodeEditor({ value, readOnly, onChange }: CodeEditorProps) {
  return <textarea aria-label="Code editor" value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />;
}
```

- [ ] **Step 3: Write the failing editor panel tests**

`src/features/automation/editor-panel.test.tsx`:
```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { fileAt, mergeRequest } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { EditorPanel } from './editor-panel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./code-editor', () => import('@/test/code-editor-mock'));

const FILE = 'e2e/auth/login.spec.ts';
const FILE_ROUTE = 'GET /projects/p1/automation/file';
const SAVE_ROUTE = 'PUT /projects/p1/automation/file';
const saved = { branch: 'tests/amina-login-fixes', commitId: 'c2', mergeRequest };

function renderPanel(props: Partial<ComponentProps<typeof EditorPanel>> = {}) {
  const onSaved = vi.fn();
  const onDirtyChange = vi.fn();
  renderWithClient(
    <EditorPanel projectId="p1" branch="main" path={FILE} isNew={false} username="amina" onSaved={onSaved} onDirtyChange={onDirtyChange} {...props} />,
  );
  return { onSaved, user: userEvent.setup() };
}

describe('EditorPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for a work name on the first save from the default branch', async () => {
    const { callsTo } = mockRoutes({ [FILE_ROUTE]: fileAt('main', 'old', 'c1'), [SAVE_ROUTE]: saved });
    const { onSaved, user } = renderPanel();

    const editor = await screen.findByLabelText('Code editor');
    expect(editor).toHaveValue('old');
    fireEvent.change(editor, { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    expect(screen.getByText('tests/amina-login-fixes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toEqual({
      path: FILE,
      content: 'new',
      lastCommitId: 'c1',
      branchSlug: 'login-fixes',
    });
  });

  it("saves straight to the user's work branch without asking", async () => {
    const { callsTo } = mockRoutes({ [FILE_ROUTE]: fileAt('tests/amina-login-fixes', 'old', 'c1'), [SAVE_ROUTE]: saved });
    const { onSaved, user } = renderPanel({ branch: 'tests/amina-login-fixes' });

    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(screen.queryByLabelText('Work name')).not.toBeInTheDocument();
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toMatchObject({ branchSlug: 'login-fixes', lastCommitId: 'c1' });
  });

  it('shows the stale-file message on 409 and reloads the latest version', async () => {
    let reads = 0;
    mockRoutes({
      [FILE_ROUTE]: () => (reads++ === 0 ? fileAt('tests/amina-login-fixes', 'old', 'c1') : fileAt('tests/amina-login-fixes', 'theirs', 'c3')),
      [SAVE_ROUTE]: () => apiError(409, 'This file changed on the branch – reload it before saving'),
    });
    const { onSaved, user } = renderPanel({ branch: 'tests/amina-login-fixes' });

    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'mine' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file changed on the branch – reload it before saving');
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(screen.getByLabelText('Code editor')).toHaveValue('theirs'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens files over 1 MB read-only', async () => {
    mockRoutes({ [FILE_ROUTE]: fileAt('main', 'big', 'c1', { size: 2_000_000, readOnly: true }) });
    renderPanel();
    expect(await screen.findByLabelText('Code editor')).toHaveAttribute('readonly');
    expect(screen.getByText(/larger than 1 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
```

Run: `npm test -- editor-panel`
Expected: FAIL with "Failed to resolve import './editor-panel'".

- [ ] **Step 4: Implement the work name dialog, the new file dialog and the editor panel**

`src/features/automation/work-name-dialog.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify, workBranchName } from '@/features/gitlab/paths';

interface WorkNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  pending: boolean;
  onConfirm: (slug: string) => void;
}

/** Asked on the first save from the default branch (spec §6): names the work branch tests/<username>-<slug>. */
export function WorkNameDialog({ open, onOpenChange, username, pending, onConfirm }: WorkNameDialogProps) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  const slug = slugify(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name your work</DialogTitle>
          <DialogDescription>
            Your changes go to your own branch with a merge request, never straight to the default branch. Give the work a short
            name, e.g. “login fixes”.
          </DialogDescription>
        </DialogHeader>
        <form
          id="work-name-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (slug && !pending) onConfirm(slug);
          }}
        >
          <Label htmlFor="work-name">Work name</Label>
          <Input id="work-name" maxLength={60} placeholder="login fixes" value={name} onChange={(e) => setName(e.target.value)} />
          {slug ? (
            <p className="text-xs text-muted-foreground">
              Branch: <span className="font-mono">{workBranchName(username, slug)}</span>
            </p>
          ) : name.trim() ? (
            <p className="text-xs text-destructive">Use at least one letter or number (a–z, 0–9).</p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="work-name-form" disabled={!slug || pending}>
            {pending ? 'Saving…' : 'Save to my branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`src/features/automation/new-file-dialog.tsx`:
```tsx
'use client';

import { FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinPath, newFilePathError, normalizeFolder } from '@/features/gitlab/paths';

interface NewFileDialogProps {
  testsPath: string;
  /** Repository paths of the files that already exist on the branch. */
  existing: Set<string>;
  onCreate: (path: string) => void;
}

/** New file inside the tests folder only (spec §6). It exists in GitLab once it is saved. */
export function NewFileDialog({ testsPath, existing, onCreate }: NewFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const folder = normalizeFolder(testsPath);
  const fullPath = joinPath(folder, name);
  const error = newFilePathError(name) ?? (existing.has(fullPath) ? 'A file with this path already exists' : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePlus2 className="mr-1.5 h-4 w-4" aria-hidden />
          New file
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New test file</DialogTitle>
          <DialogDescription>
            The file is created in <span className="font-mono">{folder}</span> on your work branch when you save it.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-file-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (error) return;
            onCreate(fullPath);
            setOpen(false);
          }}
        >
          <Label htmlFor="new-file-path">File path</Label>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm text-muted-foreground">{folder}/</span>
            <Input id="new-file-path" className="font-mono" placeholder="auth/login.spec.ts" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {name.trim() && error && <p className="text-xs text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-file-form" disabled={!!error}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`src/features/automation/editor-panel.tsx`:
```tsx
'use client';

import { Copy, RefreshCw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationFile, useSaveAutomationFile } from '@/features/gitlab/api';
import { byteLength, languageFor, MAX_EDITABLE_BYTES, slugFromWorkBranch } from '@/features/gitlab/paths';
import { ApiError } from '@/lib/api';
import type { AutomationFile, SaveFileResult } from '@/lib/types';
import { CodeEditor } from './code-editor';
import { WorkNameDialog } from './work-name-dialog';

const STALE_MESSAGE = 'This file changed on the branch – reload it before saving';

export const NEW_FILE_TEMPLATE = `import { expect, test } from '@playwright/test';

// Tag each test with the test case it covers, e.g. @TC-AUTH-001, so automated runs fill in that case's result.
test('describe what the test checks @TC-XXX-000', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
`;

interface Edit {
  /** The version the edit started from. Its lastCommitId is sent with the save for the conflict check. */
  base: AutomationFile;
  draft: string;
}

interface EditorPanelProps {
  projectId: string;
  branch: string;
  /** Repository-relative path inside the tests folder. */
  path: string;
  /** A file made with "New file" that doesn't exist in GitLab yet. */
  isNew: boolean;
  /** The user's GitLab username: their work branches are tests/<username>-<slug>. */
  username: string;
  onSaved: (result: SaveFileResult) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function EditorPanel({ projectId, branch, path, isNew, username, onSaved, onDirtyChange }: EditorPanelProps) {
  const file = useAutomationFile(projectId, branch, isNew ? null : path);
  const save = useSaveAutomationFile(projectId);
  // null = no local changes, so show the latest loaded version. Once the user types, the edit pins its base
  // and later refetches no longer replace the text. Only "Reload" does that.
  const [edit, setEdit] = useState<Edit | null>(() =>
    isNew
      ? { base: { path, ref: branch, content: '', lastCommitId: '', size: 0, readOnly: false }, draft: NEW_FILE_TEMPLATE }
      : null,
  );
  const [conflict, setConflict] = useState<string | null>(null);
  const [askWorkName, setAskWorkName] = useState(false);

  const current = edit ?? (file.data ? { base: file.data, draft: file.data.content } : null);
  // The API flags files over 1 MB; the size check covers a response without the flag.
  const readOnly = !!current && (current.base.readOnly || current.base.size > MAX_EDITABLE_BYTES);
  const dirty = !!edit && !readOnly && (isNew || edit.draft !== edit.base.content);
  const workSlug = slugFromWorkBranch(branch, username);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current(false), []);

  async function commit(branchSlug: string) {
    if (!current) return;
    const content = current.draft;
    try {
      const result = await save.mutateAsync({
        path,
        content,
        lastCommitId: isNew ? undefined : current.base.lastCommitId,
        branchSlug,
      });
      setAskWorkName(false);
      // Text typed while the save was in flight stays in the draft. The saved text becomes the new base.
      setEdit((prev) => ({
        base: { path, ref: result.branch, content, lastCommitId: result.commitId, size: byteLength(content), readOnly: false },
        draft: prev?.draft ?? content,
      }));
      toast.success(`Saved to ${result.branch}`);
      onSaved(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAskWorkName(false);
        setConflict(e.message || STALE_MESSAGE);
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not save the file');
      }
    }
  }

  function requestSave() {
    if (workSlug) void commit(workSlug);
    else setAskWorkName(true);
  }

  async function reload() {
    const fresh = await file.refetch();
    if (fresh.data) {
      setEdit(null);
      setConflict(null);
    }
  }

  async function copyDraft() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.draft);
      toast.success('Your changes are copied');
    } catch {
      toast.error('Could not copy. Select the text in the editor and copy it by hand.');
    }
  }

  if (!current) {
    if (file.isError) return <ErrorState error={file.error} onRetry={() => file.refetch()} />;
    return <LoadingState label="Opening file…" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm" title={path}>
          {path}
          {isNew && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-sans text-xs text-accent-foreground">New file</span>}
        </p>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button onClick={requestSave} disabled={!dirty || !!conflict || save.isPending}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {!workSlug && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Saving puts your changes on your own work branch with a merge request. Nothing is committed to{' '}
          <span className="font-mono">{branch}</span>.
        </p>
      )}
      {readOnly && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This file is larger than 1 MB, so it opens read-only. Edit it in GitLab.
        </p>
      )}
      {conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked-fg"
        >
          <span className="min-w-0 flex-1">
            {conflict.replace(/\.$/, '')}. Reloading replaces your changes, so copy them first if you need them.
          </span>
          <Button size="sm" variant="outline" onClick={() => void copyDraft()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Copy my changes
          </Button>
          {!isNew && (
            <Button size="sm" onClick={() => void reload()} disabled={file.isFetching}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reload
            </Button>
          )}
        </div>
      )}
      <CodeEditor
        value={current.draft}
        language={languageFor(path)}
        readOnly={readOnly}
        onChange={(value) => setEdit({ base: current.base, draft: value })}
      />
      <WorkNameDialog
        open={askWorkName}
        onOpenChange={setAskWorkName}
        username={username}
        pending={save.isPending}
        onConfirm={(slug) => void commit(slug)}
      />
    </div>
  );
}
```

Run: `npm test -- editor-panel`
Expected: 4 tests pass.

- [ ] **Step 5: Replace the Automation view tests with the save flow included**

`src/features/automation/automation-view.test.tsx` (replace the file):
```tsx
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTreeEntry } from '@/lib/types';
import { mockRoutes, type MockCall } from '@/test/fetch-routes';
import { branchList, fileAt, linkedProject, mainBranch, mergeRequest, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { AutomationView } from './automation-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./code-editor', () => import('@/test/code-editor-mock'));

const trees: Record<string, AutomationTreeEntry[]> = {
  main: [{ path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' }],
  'tests/amina-login-fixes': [
    { path: 'e2e/auth', name: 'auth', type: 'tree' },
    { path: 'e2e/auth/login.spec.ts', name: 'login.spec.ts', type: 'blob' },
    { path: 'e2e/home.spec.ts', name: 'home.spec.ts', type: 'blob' },
  ],
};
const treeRoute = ({ query }: MockCall) => treeAt(query.ref, trees[query.ref] ?? []);

describe('AutomationView', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the user's work branch with its merge request and files", async () => {
    const { callsTo } = mockRoutes({
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    expect(await screen.findByRole('button', { name: /login\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Branch')).toHaveValue('tests/amina-login-fixes');
    expect(screen.getByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(callsTo('GET', '/projects/p1/automation/tree').map((c) => c.query.ref)).toEqual(['tests/amina-login-fixes']);
  });

  it("shows another branch's files after switching branches", async () => {
    mockRoutes({
      'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
      'GET /projects/p1/automation/tree': treeRoute,
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await screen.findByRole('button', { name: /login\.spec\.ts/ });
    await user.selectOptions(screen.getByLabelText('Branch'), 'main');

    expect(await screen.findByRole('button', { name: /home\.spec\.ts/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login\.spec\.ts/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Merge request/ })).not.toBeInTheDocument();
  });

  it('switches to the new work branch after the first save and shows its merge request', async () => {
    let saved = false;
    const { callsTo } = mockRoutes({
      'GET /projects/p1/automation/branches': () => (saved ? branchList(mainBranch, workBranch) : branchList(mainBranch)),
      'GET /projects/p1/automation/tree': treeRoute,
      'GET /projects/p1/automation/file': ({ query }: MockCall) =>
        query.ref === workBranch.name ? fileAt(workBranch.name, 'new', 'c2') : fileAt('main', 'old', 'c1'),
      'PUT /projects/p1/automation/file': () => {
        saved = true;
        return { branch: workBranch.name, commitId: 'c2', mergeRequest };
      },
    });
    const user = userEvent.setup();
    renderWithClient(<AutomationView project={linkedProject} repo={repo} username="amina" />);

    await user.click(await screen.findByRole('button', { name: /home\.spec\.ts/ }));
    const editor = await screen.findByLabelText('Code editor');
    expect(editor).toHaveValue('old');
    fireEvent.change(editor, { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    expect(await screen.findByRole('link', { name: /Merge request !7/ })).toHaveAttribute('href', mergeRequest.webUrl);
    expect(screen.getByLabelText('Branch')).toHaveValue(workBranch.name);
    expect(await screen.findByLabelText('Code editor')).toHaveValue('new');
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toMatchObject({ path: 'e2e/home.spec.ts', branchSlug: 'login-fixes' });
  });
});
```

Run: `npm test -- automation-view`
Expected: the first two tests pass. The new one fails because the view has no editor yet (`Unable to find a label with the text of: Code editor`).

- [ ] **Step 6: Replace the Automation view**

`src/features/automation/automation-view.tsx` (replace the file):
```tsx
'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useAutomationBranches, useAutomationTree } from '@/features/gitlab/api';
import { initialBranch, normalizeFolder } from '@/features/gitlab/paths';
import type { ProjectDetail, RepositoryLink, SaveFileResult } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { EditorPanel } from './editor-panel';
import { buildFileTree } from './file-tree';
import { FileTreeView } from './file-tree-view';
import { MergeRequestLink } from './merge-request-link';
import { NewFileDialog } from './new-file-dialog';

interface AutomationViewProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** The current user's GitLab username (their work branches are tests/<username>-<slug>). */
  username: string;
}

interface OpenFile {
  path: string;
  isNew: boolean;
}

type Change = { kind: 'branch'; branch: string } | { kind: 'file'; file: OpenFile };

export function AutomationView({ project, repo, username }: AutomationViewProps) {
  const branches = useAutomationBranches(project.id);
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingChange, setPendingChange] = useState<Change | null>(null);
  const [lastSave, setLastSave] = useState<SaveFileResult | null>(null);
  const branch = chosenBranch ?? (branches.data ? initialBranch(branches.data.branches, username, repo.defaultBranch) : '');
  const tree = useAutomationTree(project.id, branch);
  const nodes = useMemo(() => buildFileTree(tree.data?.entries ?? [], repo.testsPath), [tree.data, repo.testsPath]);
  const existingPaths = useMemo(
    () => new Set((tree.data?.entries ?? []).filter((e) => e.type === 'blob').map((e) => normalizeFolder(e.path))),
    [tree.data],
  );
  const current = branches.data?.branches.find((b) => b.name === branch);
  // Right after the first save the branch list may not have refetched yet, so fall back to the save's MR.
  const mergeRequest = current?.mergeRequest ?? (lastSave?.branch === branch ? lastSave.mergeRequest : null);

  // Warn before leaving the page with unsaved editor changes.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (branches.isPending) return <LoadingState label="Loading branches…" />;
  if (branches.isError) return <ErrorState error={branches.error} onRetry={() => branches.refetch()} />;

  function apply(change: Change) {
    if (change.kind === 'branch') {
      setChosenBranch(change.branch);
      setOpenFile(null);
    } else {
      setOpenFile(change.file);
    }
    setDirty(false);
  }

  function request(change: Change) {
    if (dirty) setPendingChange(change);
    else apply(change);
  }

  function handleSaved(result: SaveFileResult) {
    setLastSave(result);
    setChosenBranch(result.branch);
    setOpenFile((f) => (f ? { path: f.path, isNew: false } : f));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <BranchSelect branches={branches.data.branches} value={branch} onChange={(next) => request({ kind: 'branch', branch: next })} />
        {mergeRequest && <MergeRequestLink mergeRequest={mergeRequest} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NewFileDialog
            testsPath={repo.testsPath}
            existing={existingPaths}
            onCreate={(path) => request({ kind: 'file', file: { path, isNew: true } })}
          />
          <Button variant="ghost" asChild>
            <a href={repo.gitlabWebUrl} target="_blank" rel="noopener noreferrer">
              Open in GitLab
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Tests folder" className="min-w-0 rounded-xl border bg-card p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tests folder <span className="font-mono normal-case">{normalizeFolder(repo.testsPath)}</span>
          </p>
          {tree.isPending ? (
            <LoadingState label="Loading files…" />
          ) : tree.isError ? (
            <ErrorState error={tree.error} onRetry={() => tree.refetch()} />
          ) : nodes.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">No files in this folder on this branch yet.</p>
          ) : (
            <FileTreeView
              nodes={nodes}
              testsPath={repo.testsPath}
              selectedPath={openFile?.path ?? null}
              onSelect={(path) => {
                if (path !== openFile?.path) request({ kind: 'file', file: { path, isNew: false } });
              }}
            />
          )}
        </section>
        <section id="automation-editor" aria-label="Editor" className="min-w-0 rounded-xl border bg-card p-4">
          {openFile ? (
            <EditorPanel
              key={`${branch}:${openFile.path}:${openFile.isNew ? 'new' : 'existing'}`}
              projectId={project.id}
              branch={branch}
              path={openFile.path}
              isNew={openFile.isNew}
              username={username}
              onSaved={handleSaved}
              onDirtyChange={setDirty}
            />
          ) : (
            <EmptyState title="Select a file" description="Choose a test file on the left to open it, or create a new one." />
          )}
        </section>
      </div>
      <ConfirmDialog
        open={!!pendingChange}
        onOpenChange={(o) => {
          if (!o) setPendingChange(null);
        }}
        title="Discard unsaved changes?"
        description={`Your changes to ${openFile?.path ?? 'this file'} haven't been saved.`}
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          if (pendingChange) apply(pendingChange);
          setPendingChange(null);
        }}
      />
    </div>
  );
}
```

Run: `npm test -- automation-view editor-panel`
Expected: 7 tests pass.

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 88 tests pass (83 + editor 4 + view 1), and typecheck, lint and build succeed. The build log starts with "Copied Monaco editor to public/monaco/vs". If the API is running with a linked project, smoke-check this flow:
1. Open a spec file. Monaco shows it with TypeScript highlighting and no red squiggles under `@playwright/test`.
2. Edit it and press Save on the default branch. Give the work name "login fixes". The toast says "Saved to tests/<you>-login-fixes", the branch selector switches to it, and "Merge request !N · Open" links to GitLab. Its description lists the file.
3. Edit the same file in GitLab on that branch, then save again here. The 409 banner appears, and Reload shows GitLab's version.
4. New file → `auth/new.spec.ts` opens the template. Saving creates it on the work branch, and it appears in the tree.
5. Switching files with unsaved changes asks "Discard unsaved changes?".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Monaco test editor with save to work branch and merge request

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Coverage panel, "Not automated yet" and the CI job snippet

**Files:**
- Create: `src/features/automation/coverage-section.tsx`, `src/features/automation/ci-snippet.tsx`
- Modify: `src/features/automation/automation-view.tsx` (coverage counts in the tree, the panels below the editor), `src/features/automation/automation-view.test.tsx` (mock the two new endpoints)
- Test: `src/features/automation/coverage-section.test.tsx`, `src/features/automation/ci-snippet.test.tsx`

**Interfaces:**
- Consumes: `useCoverage`, `useCiSnippet` (Task 1); page states. API: `GET /projects/:id/automation/coverage?ref=` → `CoverageReport`; `GET /projects/:id/automation/ci-snippet` → `{ playwrightConfigPath, yaml }` (the job already carries `--config` for a non-default config).
- Produces:
  - `<CoverageSection projectId projectKey gitRef onOpenFile(path) />`. **Coverage** shows "N of M test cases automated (P%)" (M = automated + not automated) and each tagged file (a button that opens it) with its case codes (links to `/projects/{KEY}/cases/{id}`). Tags that match no case (`unknownCodes`) are shown as amber chips. **Not automated yet (K)** lists code, name and module.
  - `<CiSnippet projectId />`: the YAML in a `<pre>` with a **Copy** button (shows "Copied" for 2 s)
  - In the Automation view, tree files show how many cases they cover, and "open file" from Coverage opens the file in the editor.

- [ ] **Step 1: Write the failing coverage and CI snippet tests**

`src/features/automation/coverage-section.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageReport } from '@/lib/types';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { CoverageSection } from './coverage-section';

const report: CoverageReport = {
  ref: 'main',
  commitId: 'abc123',
  files: [
    {
      path: 'e2e/auth/login.spec.ts',
      cases: [
        { id: 'c1', code: 'TC-AUTH-001', name: 'Login with email' },
        { id: 'c2', code: 'TC-AUTH-002', name: 'Logout' },
      ],
      unknownCodes: ['TC-AUTH-999'],
    },
    { path: 'e2e/home.spec.ts', cases: [], unknownCodes: [] },
  ],
  notAutomated: [{ id: 'c3', code: 'TC-AUTH-003', name: 'Reset password', module: { code: 'AUTH', name: 'Authentication' } }],
};

describe('CoverageSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows how many cases are automated and which files cover them', async () => {
    const { callsTo } = mockRoutes({ 'GET /projects/p1/automation/coverage': report });
    const onOpenFile = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={onOpenFile} />);

    expect(await screen.findByText(/2 of 3 test cases automated \(67%\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TC-AUTH-001' })).toHaveAttribute('href', '/projects/NINJA/cases/c1');
    expect(screen.getByText('TC-AUTH-999')).toHaveAttribute('title', 'No test case has this code, so its results come back Unlinked');
    expect(screen.queryByRole('button', { name: 'e2e/home.spec.ts' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'e2e/auth/login.spec.ts' }));
    expect(onOpenFile).toHaveBeenCalledWith('e2e/auth/login.spec.ts');
    expect(callsTo('GET', '/projects/p1/automation/coverage')[0].query).toEqual({ ref: 'main' });
  });

  it('lists the cases no test is tagged with yet', async () => {
    mockRoutes({ 'GET /projects/p1/automation/coverage': report });
    renderWithClient(<CoverageSection projectId="p1" projectKey="NINJA" gitRef="main" onOpenFile={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Not automated yet (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TC-AUTH-003' })).toHaveAttribute('href', '/projects/NINJA/cases/c3');
    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });
});
```

`src/features/automation/ci-snippet.test.tsx`:
```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { CiSnippet } from './ci-snippet';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('CiSnippet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the CI job and copies it', async () => {
    const yaml = 'ejad-playwright:\n  image: mcr.microsoft.com/playwright:v1.47.0-jammy\n';
    mockRoutes({ 'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml } });
    const user = userEvent.setup();
    renderWithClient(<CiSnippet projectId="p1" />);

    expect(await screen.findByText(/ejad-playwright:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(yaml);
  });
});
```

Run: `npm test -- coverage-section ci-snippet`
Expected: FAIL with "Failed to resolve import './coverage-section'" and "Failed to resolve import './ci-snippet'".

- [ ] **Step 2: Implement the coverage section**

`src/features/automation/coverage-section.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/page-state';
import { useCoverage } from '@/features/gitlab/api';
import type { CoverageReport, NotAutomatedCase } from '@/lib/types';

interface CoverageSectionProps {
  projectId: string;
  projectKey: string;
  /** Branch to scan (the Automation tab's selected branch). */
  gitRef: string;
  onOpenFile: (path: string) => void;
}

function CoveragePanel({ report, projectKey, onOpenFile }: { report: CoverageReport; projectKey: string; onOpenFile: (path: string) => void }) {
  const automated = new Set(report.files.flatMap((f) => f.cases.map((c) => c.id)));
  const total = automated.size + report.notAutomated.length;
  const percent = total ? Math.round((automated.size / total) * 100) : 0;
  const files = report.files.filter((f) => f.cases.length > 0 || f.unknownCodes.length > 0);

  return (
    <section aria-labelledby="coverage-heading" className="min-w-0 rounded-xl border bg-card p-4">
      <h3 id="coverage-heading" className="font-medium">
        Coverage
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {automated.size} of {total} test cases automated ({percent}%). Link a test to a case by putting the case code in the
        test&apos;s title, e.g. <code className="font-mono">@TC-AUTH-001</code>.
      </p>
      {files.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No test is tagged with a test case code yet.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {files.map((f) => (
            <li key={f.path} className="py-2">
              <button type="button" onClick={() => onOpenFile(f.path)} className="break-all text-left font-mono text-sm text-primary hover:underline">
                {f.path}
              </button>
              <div className="mt-1 flex flex-wrap gap-1">
                {f.cases.map((c) => (
                  <Link
                    key={c.id}
                    href={`/projects/${projectKey}/cases/${c.id}`}
                    title={c.name}
                    className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-accent-foreground hover:underline"
                  >
                    {c.code}
                  </Link>
                ))}
                {f.unknownCodes.map((code) => (
                  <span
                    key={code}
                    title="No test case has this code, so its results come back Unlinked"
                    className="rounded bg-status-blocked/20 px-1.5 py-0.5 font-mono text-xs text-status-blocked-fg"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotAutomatedList({ cases, projectKey }: { cases: NotAutomatedCase[]; projectKey: string }) {
  return (
    <section aria-labelledby="not-automated-heading" className="min-w-0 rounded-xl border bg-card p-4">
      <h3 id="not-automated-heading" className="font-medium">
        Not automated yet <span className="text-muted-foreground">({cases.length})</span>
      </h3>
      {cases.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Every test case has an automated test.</p>
      ) : (
        <ul className="mt-3 max-h-80 divide-y overflow-y-auto">
          {cases.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
              <Link href={`/projects/${projectKey}/cases/${c.id}`} className="w-28 shrink-0 font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
                {c.code}
              </Link>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.module.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Coverage by @TC tags on the selected branch, plus approved cases no test covers (spec §6). */
export function CoverageSection({ projectId, projectKey, gitRef, onOpenFile }: CoverageSectionProps) {
  const coverage = useCoverage(projectId, gitRef);
  if (coverage.isPending) {
    return (
      <section aria-label="Coverage" className="rounded-xl border bg-card p-4">
        <LoadingState label="Scanning tests for @TC tags…" />
      </section>
    );
  }
  if (coverage.isError) {
    return (
      <section aria-label="Coverage" className="rounded-xl border bg-card p-4">
        <ErrorState error={coverage.error} onRetry={() => coverage.refetch()} />
      </section>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CoveragePanel report={coverage.data} projectKey={projectKey} onOpenFile={onOpenFile} />
      <NotAutomatedList cases={coverage.data.notAutomated} projectKey={projectKey} />
    </div>
  );
}
```

- [ ] **Step 3: Implement the CI snippet**

`src/features/automation/ci-snippet.tsx`:
```tsx
'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useCiSnippet } from '@/features/gitlab/api';

/** The provided `.gitlab-ci.yml` job (spec §7), with a copy button. */
export function CiSnippet({ projectId }: { projectId: string }) {
  const snippet = useCiSnippet(projectId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!snippet.data) return;
    try {
      await navigator.clipboard.writeText(snippet.data);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  }

  return (
    <section aria-labelledby="ci-heading" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 id="ci-heading" className="font-medium">
            CI job for GitLab
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add this job to the repository&apos;s <code className="font-mono">.gitlab-ci.yml</code> once. &quot;Run tests&quot; starts it with the run&apos;s
            scope. Set the image tag to match the repository&apos;s <code className="font-mono">@playwright/test</code> version.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void copy()} disabled={!snippet.data}>
          {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {snippet.isPending ? (
        <LoadingState />
      ) : snippet.isError ? (
        <ErrorState error={snippet.error} onRetry={() => snippet.refetch()} />
      ) : (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          <code>{snippet.data}</code>
        </pre>
      )}
    </section>
  );
}
```

Run: `npm test -- coverage-section ci-snippet`
Expected: 3 tests pass.

- [ ] **Step 4: Show coverage in the Automation view**

In `src/features/automation/automation-view.tsx`:

1. Change the gitlab API import to `import { useAutomationBranches, useAutomationTree, useCoverage } from '@/features/gitlab/api';`, and add:
```tsx
import { CiSnippet } from './ci-snippet';
import { CoverageSection } from './coverage-section';
```
2. Directly after the `const mergeRequest = …;` line (before the `beforeunload` effect, so the hook order never changes), add:
```tsx
  const coverage = useCoverage(project.id, branch);
  const caseCounts = useMemo(
    () => Object.fromEntries((coverage.data?.files ?? []).map((f) => [f.path, f.cases.length])),
    [coverage.data],
  );
```
3. After the `handleSaved` function, add:
```tsx
  function openFromCoverage(path: string) {
    if (path !== openFile?.path || openFile.isNew) request({ kind: 'file', file: { path, isNew: false } });
    document.getElementById('automation-editor')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
```
4. Pass the counts to the tree: add `caseCounts={caseCounts}` to `<FileTreeView … />`.
5. Between the closing `</div>` of the tree/editor grid and `<ConfirmDialog`, add:
```tsx
      <CoverageSection projectId={project.id} projectKey={project.key} gitRef={branch} onOpenFile={openFromCoverage} />
      <CiSnippet projectId={project.id} />
```

In `src/features/automation/automation-view.test.tsx`, after the `treeRoute` line add:
```tsx
// The coverage and CI panels (Task 5) load too. These tests don't look at them.
const panelRoutes = {
  'GET /projects/p1/automation/coverage': { ref: 'main', commitId: 'abc', files: [], notAutomated: [] },
  'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml: 'ejad-playwright:\n' },
};
```
Then add `...panelRoutes,` as the first entry of each of the three `mockRoutes({ … })` calls.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 91 tests pass (88 + coverage 2 + CI snippet 1), and typecheck, lint and build succeed. If the API is running with a linked project, smoke-check this flow: tag a test `@TC-<code>` in the editor and save. The Coverage panel lists the file with that code, the tree shows a count next to the file, the case leaves "Not automated yet", and Copy puts the YAML on the clipboard.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: automation coverage by @TC tags, not-automated list and CI job snippet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Run tests dialog (branch + scope)

**Files:**
- Create: `src/features/automation/run-scope.ts`, `src/features/automation/run-tests-dialog.tsx`
- Modify: `src/features/runs/new-run-dialog.tsx` (export `CasePicker`), `src/features/automation/automation-view.tsx` (toolbar button), `src/app/(app)/projects/[key]/runs/page.tsx` (button when ready)
- Test: `src/features/automation/run-scope.test.ts`, `src/features/automation/run-tests-dialog.test.tsx`

**Interfaces:**
- Consumes: `useAutomationBranches`, `useAutomationTree`, `useRunAutomated`, `automationAccess`, `normalizeFolder` (Task 1); `BranchSelect` (Task 3); `CasePicker` (Phase 1 `new-run-dialog.tsx`, now exported). API: `POST /projects/:id/runs/automated { branch, scope: { mode: ALL|PATH|CASES, path?, caseIds? } }` → 201 run detail. If GitLab refuses the pipeline, the run comes back `COMPLETED` with `note = "GitLab could not start the pipeline: …"`. No GitLab connection → 403 and no run (spec §7). The run page shows that note (Task 7).
- Produces:
  - `interface ScopeState { mode: AutomatedScopeMode; path: string; caseIds: string[] }`; `buildScope(state): AutomatedRunScope` (only the fields for the chosen mode, with the path normalized); `scopeError(state, testsPath): string | null`
  - `<RunTestsDialog project repo initialBranch? initialPath? triggerVariant? />`: the trigger button is "Run tests". The dialog has the branch, the scope (All tests / A folder or file / Selected test cases) and "Start pipeline", and afterwards goes to `/projects/{KEY}/runs/{runId}`.
  - The Automation toolbar opens it preset to the current branch and open file. The Runs tab shows it next to "New run" when `automationAccess(...).state === 'ready'`.

- [ ] **Step 1: Write the failing scope tests**

`src/features/automation/run-scope.test.ts`:
```ts
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
```

Run: `npm test -- run-scope`
Expected: FAIL with "Failed to resolve import './run-scope'".

- [ ] **Step 2: Implement the scope helpers**

`src/features/automation/run-scope.ts`:
```ts
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
```

Run: `npm test -- run-scope`
Expected: 3 tests pass.

- [ ] **Step 3: Write the failing dialog tests**

`src/features/automation/run-tests-dialog.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { branchList, linkedProject, mainBranch, repo, treeAt, workBranch } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { RunTestsDialog } from './run-tests-dialog';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const routes = {
  'GET /projects/p1/automation/branches': branchList(mainBranch, workBranch),
  'GET /projects/p1/automation/tree': treeAt('main', [{ path: 'e2e/auth', name: 'auth', type: 'tree' }]),
};

describe('RunTestsDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts a pipeline for a folder on the chosen branch and opens the run', async () => {
    const { callsTo } = mockRoutes({ ...routes, 'POST /projects/p1/runs/automated': { id: 'run9' } });
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await screen.findByRole('option', { name: /tests\/amina-login-fixes/ });
    await user.selectOptions(screen.getByLabelText('Branch'), 'tests/amina-login-fixes');
    await user.click(screen.getByLabelText('A folder or file'));
    const path = screen.getByLabelText('Folder or file');
    await user.clear(path);
    await user.type(path, 'e2e/auth/');
    await user.click(screen.getByRole('button', { name: 'Start pipeline' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/NINJA/runs/run9'));
    expect(callsTo('POST', '/projects/p1/runs/automated')[0].body).toEqual({
      branch: 'tests/amina-login-fixes',
      scope: { mode: 'PATH', path: 'e2e/auth' },
    });
  });

  it('blocks a path outside the tests folder', async () => {
    mockRoutes(routes);
    const user = userEvent.setup();
    renderWithClient(<RunTestsDialog project={linkedProject} repo={repo} />);

    await user.click(screen.getByRole('button', { name: 'Run tests' }));
    await user.click(screen.getByLabelText('A folder or file'));
    const path = screen.getByLabelText('Folder or file');
    await user.clear(path);
    await user.type(path, 'src/app');

    expect(screen.getByText('Choose a folder or file inside e2e')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start pipeline' })).toBeDisabled();
  });
});
```

Run: `npm test -- run-tests-dialog`
Expected: FAIL with "Failed to resolve import './run-tests-dialog'".

- [ ] **Step 4: Export the Phase 1 case picker**

In `src/features/runs/new-run-dialog.tsx`, change `function CasePicker(` to `export function CasePicker(` (leave everything else as it is).

- [ ] **Step 5: Implement the dialog**

`src/features/automation/run-tests-dialog.tsx`:
```tsx
'use client';

import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAutomationBranches, useAutomationTree, useRunAutomated } from '@/features/gitlab/api';
import { normalizeFolder } from '@/features/gitlab/paths';
import { CasePicker } from '@/features/runs/new-run-dialog';
import { ApiError } from '@/lib/api';
import type { AutomatedScopeMode, ProjectDetail, RepositoryLink } from '@/lib/types';
import { BranchSelect } from './branch-select';
import { buildScope, scopeError, type ScopeState } from './run-scope';

const MODES: { value: AutomatedScopeMode; label: string }[] = [
  { value: 'ALL', label: 'All tests' },
  { value: 'PATH', label: 'A folder or file' },
  { value: 'CASES', label: 'Selected test cases' },
];

interface RunTestsDialogProps {
  project: ProjectDetail;
  repo: RepositoryLink;
  /** Preselected when the dialog opens, e.g. the Automation tab's branch and open file. */
  initialBranch?: string;
  initialPath?: string;
  triggerVariant?: 'default' | 'outline';
}

/** Starts a GitLab CI pipeline as the current user and opens the new automated run (spec §7). */
export function RunTestsDialog({ project, repo, initialBranch, initialPath, triggerVariant = 'default' }: RunTestsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState(initialBranch || repo.defaultBranch);
  const [scope, setScope] = useState<ScopeState>({ mode: 'ALL', path: initialPath ?? normalizeFolder(repo.testsPath), caseIds: [] });
  const branches = useAutomationBranches(project.id, open);
  const tree = useAutomationTree(project.id, open ? branch : '');
  const start = useRunAutomated(project.id);
  const error = scopeError(scope, repo.testsPath);
  const canSubmit = !!branch && !error && !start.isPending;

  function reset() {
    setBranch(initialBranch || repo.defaultBranch);
    setScope({ mode: 'ALL', path: initialPath ?? normalizeFolder(repo.testsPath), caseIds: [] });
  }

  function toggleCase(id: string) {
    setScope((s) => ({ ...s, caseIds: s.caseIds.includes(id) ? s.caseIds.filter((c) => c !== id) : [...s.caseIds, id] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const run = await start.mutateAsync({ branch, scope: buildScope(scope) });
      setOpen(false);
      router.push(`/projects/${project.key}/runs/${run.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the tests');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Play className="mr-1.5 h-4 w-4" aria-hidden />
          Run tests
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Run automated tests</DialogTitle>
          <DialogDescription>
            Starts a GitLab CI pipeline with your GitLab account. A new automated run shows the pipeline status, and its results
            appear when the pipeline finishes.
          </DialogDescription>
        </DialogHeader>
        <form id="run-tests-form" onSubmit={submit} className="space-y-4">
          <BranchSelect id="run-tests-branch" branches={branches.data?.branches ?? []} value={branch} onChange={setBranch} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tests to run</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="run-tests-scope"
                    value={m.value}
                    checked={scope.mode === m.value}
                    onChange={() => setScope({ ...scope, mode: m.value })}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            {scope.mode === 'PATH' && (
              <div className="space-y-1.5">
                <Label htmlFor="run-tests-path">Folder or file</Label>
                <Input
                  id="run-tests-path"
                  list="run-tests-paths"
                  className="font-mono"
                  value={scope.path}
                  onChange={(e) => setScope({ ...scope, path: e.target.value })}
                />
                <datalist id="run-tests-paths">
                  {(tree.data?.entries ?? []).map((entry) => (
                    <option key={entry.path} value={entry.path} />
                  ))}
                </datalist>
              </div>
            )}
            {scope.mode === 'CASES' && (
              <>
                <CasePicker projectId={project.id} selected={scope.caseIds} onToggle={toggleCase} />
                <p className="text-xs text-muted-foreground">Runs the tests whose titles carry these cases&apos; tags, e.g. @TC-AUTH-001.</p>
              </>
            )}
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="run-tests-form" disabled={!canSubmit}>
            {start.isPending ? 'Starting…' : 'Start pipeline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Run: `npm test -- run-tests-dialog run-scope`
Expected: 5 tests pass.

- [ ] **Step 6: Add the button to the Automation tab and the Runs tab**

In `src/features/automation/automation-view.tsx`, add `import { RunTestsDialog } from './run-tests-dialog';`. Then put this in the toolbar's `ml-auto` group, before `<NewFileDialog`:
```tsx
          <RunTestsDialog
            project={project}
            repo={repo}
            initialBranch={branch}
            initialPath={openFile && !openFile.isNew ? openFile.path : undefined}
          />
```

`src/app/(app)/projects/[key]/runs/page.tsx`:
```tsx
'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { RunTestsDialog } from '@/features/automation/run-tests-dialog';
import { automationAccess } from '@/features/gitlab/access';
import { useGitlabStatus } from '@/features/gitlab/api';
import { useProject } from '@/features/projects/api';
import { useRuns } from '@/features/runs/api';
import { NewRunDialog } from '@/features/runs/new-run-dialog';
import { RunList } from '@/features/runs/run-list';

export default function RunsPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const runs = useRuns(project.data?.id ?? '');
  const gitlab = useGitlabStatus();
  if (!project.data) return null;
  // "Run tests" needs a linked repository and an active GitLab connection (spec §7). The Automation tab explains how to get one.
  const access = automationAccess(gitlab.data, project.data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Each run records one pass through a set of test cases, e.g. per sprint or build.</p>
        <div className="flex gap-2">
          {access.state === 'ready' && <RunTestsDialog project={project.data} repo={access.repo} triggerVariant="outline" />}
          <NewRunDialog project={project.data} />
        </div>
      </div>
      {runs.isPending ? (
        <LoadingState />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
      ) : runs.data.length === 0 ? (
        <EmptyState title="No runs yet" description="Start a run to execute the test cases and record results." />
      ) : (
        <RunList projectKey={project.data.key} runs={runs.data} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 96 tests pass (91 + scope 3 + dialog 2), and typecheck, lint and build succeed. If the API is running with a linked project and the CI job from the Automation tab in the repo, smoke-check this flow: Run tests → your work branch → "A folder or file" `e2e/auth` → Start pipeline. It opens the new automated run, and a pipeline with `EJAD_RUN_ID` and `EJAD_TEST_PATH=e2e/auth` appears in GitLab. On a repo without the job, the run comes back completed with GitLab's error as its note (it shows in Task 7).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Run tests dialog to start GitLab CI pipelines by branch and scope

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Automated run views (pipeline status, note, artifacts, Unlinked → test case)

**Files:**
- Create: `src/features/runs/pipeline.ts`, `src/features/runs/module-guess.ts`, `src/features/runs/pipeline-status-badge.tsx`, `src/features/runs/automated-run-info.tsx`, `src/features/runs/automated-result-details.tsx`, `src/features/runs/create-case-from-result-dialog.tsx`
- Modify: `src/features/runs/api.ts` (10 s polling), `src/features/runs/run-list.tsx`, `src/features/runs/run-header.tsx`, `src/features/runs/run-execution.tsx`, `src/features/runs/result-row.tsx`
- Test: `src/features/runs/pipeline.test.ts`, `src/features/runs/module-guess.test.ts`, `src/features/runs/automated-run.test.tsx`

**Interfaces:**
- Consumes: `useCreateCaseFromResult`, `reportUrlFromArtifacts` (Task 1); `useModules` (Phase 1 cases); `RunExecution`, `RunHeader`, `ResultRow`, `RunList`, `useRun`, `useRuns`, `summarizeResults` (Phase 1). API: `GET /runs/:id` and `GET /projects/:id/runs` now include `branch`, `pipelineId`, `pipelineWebUrl`, `pipelineStatus`, `note`, and results include `file`, `artifactsUrl`, `durationMs`, `errorMessage`. `POST /runs/:runId/results/:resultId/create-case { moduleId, name? }` → `{ testCase, resultId, tag }`. The result is linked to the new case, even on a completed run. Run notes can end with a job URL (e.g. `Pipeline finished without a test report – <job url>`).
- Produces:
  - `PIPELINE_POLL_MS = 10_000`; `type PipelineTone`; `pipelineStatusInfo(status): { label; tone }`; `needsPipelinePolling(run?): boolean`; `formatDuration(ms): string | null`
  - `guessModuleId(file, modules): string`; `caseNameFromTitle(title): string`
  - `<PipelineStatusBadge status />`, `<AutomatedRunInfo run compact? className? />` (branch, pipeline badge, "Pipeline #id" link, and the note with any URL in it made a link), `<AutomatedResultDetails result />` (file, duration, error, and for failed results the job artifacts and Playwright report links), `<CreateCaseFromResultDialog run result onClose />`
  - `useRun` / `useRuns` refetch every 10 s while an automated run is in progress. Automated runs are read-only: no status editing and no Complete run. Failed results show an **Artifacts** link in the row. Unlinked results show **Create test case from this**.

- [ ] **Step 1: Write the failing helper tests**

`src/features/runs/pipeline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, needsPipelinePolling, pipelineStatusInfo } from './pipeline';

describe('pipeline helpers', () => {
  it('labels GitLab pipeline statuses', () => {
    expect(pipelineStatusInfo('running')).toEqual({ label: 'Running', tone: 'running' });
    expect(pipelineStatusInfo('success')).toEqual({ label: 'Success', tone: 'passed' });
    expect(pipelineStatusInfo('failed')).toEqual({ label: 'Failed', tone: 'failed' });
    expect(pipelineStatusInfo('canceled')).toEqual({ label: 'Canceled', tone: 'skipped' });
    expect(pipelineStatusInfo('waiting_for_resource')).toEqual({ label: 'Waiting', tone: 'pending' });
    expect(pipelineStatusInfo('brand_new_state')).toEqual({ label: 'Brand new state', tone: 'pending' });
    expect(pipelineStatusInfo(null)).toEqual({ label: 'Starting', tone: 'pending' });
  });

  it('polls only automated runs that are still in progress', () => {
    expect(needsPipelinePolling({ type: 'AUTOMATED', status: 'IN_PROGRESS' })).toBe(true);
    expect(needsPipelinePolling({ type: 'AUTOMATED', status: 'COMPLETED' })).toBe(false);
    expect(needsPipelinePolling({ type: 'MANUAL', status: 'IN_PROGRESS' })).toBe(false);
    expect(needsPipelinePolling(undefined)).toBe(false);
  });

  it('formats test durations', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(12_340)).toBe('12.3 s');
    expect(formatDuration(119_600)).toBe('2 min 0 s');
  });
});
```

`src/features/runs/module-guess.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { caseNameFromTitle, guessModuleId } from './module-guess';

const modules = [
  { id: 'm1', name: 'Authentication', code: 'AUTH' },
  { id: 'm2', name: 'Checkout', code: 'CHK' },
  { id: 'm3', name: 'User Profile', code: 'PROFILE' },
];

describe('module guess', () => {
  it("guesses the module from the test file's folders and name", () => {
    expect(guessModuleId('e2e/checkout/pay.spec.ts', modules)).toBe('m2');
    expect(guessModuleId('e2e/auth/login.spec.ts', modules)).toBe('m1');
    expect(guessModuleId('e2e/user-profile.spec.ts', modules)).toBe('m3');
    expect(guessModuleId('e2e/misc/other.spec.ts', modules)).toBe('m1');
    expect(guessModuleId(null, modules)).toBe('m1');
    expect(guessModuleId('e2e/x.spec.ts', [])).toBe('');
  });

  it('turns a test title into a case name', () => {
    expect(caseNameFromTitle('checkout pays with card @smoke @TC-CHK-9')).toBe('checkout pays with card');
    expect(caseNameFromTitle('  Login   works  ')).toBe('Login works');
    expect(caseNameFromTitle(null)).toBe('');
  });
});
```

Run: `npm test -- pipeline module-guess`
Expected: FAIL with "Failed to resolve import './pipeline'" and "Failed to resolve import './module-guess'".

- [ ] **Step 2: Implement the helpers**

`src/features/runs/pipeline.ts`:
```ts
import type { RunStatus, RunType } from '@/lib/types';

/** Automated runs and the runs list refetch this often while a pipeline runs (the API polls GitLab every 20 s). */
export const PIPELINE_POLL_MS = 10_000;

export type PipelineTone = 'passed' | 'failed' | 'running' | 'pending' | 'skipped';

const PIPELINE: Record<string, { label: string; tone: PipelineTone }> = {
  created: { label: 'Created', tone: 'pending' },
  waiting_for_resource: { label: 'Waiting', tone: 'pending' },
  preparing: { label: 'Preparing', tone: 'pending' },
  pending: { label: 'Pending', tone: 'pending' },
  scheduled: { label: 'Scheduled', tone: 'pending' },
  manual: { label: 'Manual', tone: 'pending' },
  running: { label: 'Running', tone: 'running' },
  success: { label: 'Success', tone: 'passed' },
  failed: { label: 'Failed', tone: 'failed' },
  canceled: { label: 'Canceled', tone: 'skipped' },
  skipped: { label: 'Skipped', tone: 'skipped' },
};

export function pipelineStatusInfo(status: string | null | undefined): { label: string; tone: PipelineTone } {
  if (!status) return { label: 'Starting', tone: 'pending' };
  const known = PIPELINE[status];
  if (known) return known;
  const words = status.replace(/_/g, ' ');
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: 'pending' };
}

export function needsPipelinePolling(run: { type: RunType; status: RunStatus } | undefined): boolean {
  return run?.type === 'AUTOMATED' && run.status === 'IN_PROGRESS';
}

export function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
```

`src/features/runs/module-guess.ts`:
```ts
import type { ModuleRef } from '@/lib/types';

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pre-selects a module for "Create test case from this": the module whose code or name matches a folder or the
 * file name of the test (most specific first), e.g. e2e/checkout/pay.spec.ts → Checkout. Falls back to the first module.
 */
export function guessModuleId(file: string | null | undefined, modules: ModuleRef[]): string {
  const parts = (file ?? '')
    .split('/')
    .map((part) => normalize(part.replace(/(\.(spec|test))?\.[a-z]+$/i, '')))
    .filter(Boolean)
    .reverse();
  for (const part of parts) {
    const match = modules.find((m) => normalize(m.code) === part || normalize(m.name) === part);
    if (match) return match.id;
  }
  return modules[0]?.id ?? '';
}

/** A readable case name from an automated test title: drops @tags and extra spaces. */
export function caseNameFromTitle(title: string | null | undefined): string {
  return (title ?? '')
    .replace(/@[\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Run: `npm test -- pipeline module-guess`
Expected: 5 tests pass.

- [ ] **Step 3: Write the failing automated run screen tests**

`src/features/runs/automated-run.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunDetail, RunResult } from '@/lib/types';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { RunExecution } from './run-execution';
import { summarizeResults } from './summary';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom has no ResizeObserver. The Radix "Only not executed" checkbox needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const loginCase = {
  id: 'c1',
  code: 'TC-AUTH-001',
  name: 'Login with email',
  description: null,
  preconditions: null,
  steps: null,
  testData: null,
  expectedResult: null,
  priority: 'HIGH' as const,
  notes: null,
  deletedAt: null,
  module: { id: 'm1', name: 'Authentication', code: 'AUTH' },
};

function result(over: Partial<RunResult>): RunResult {
  return {
    id: 'r1',
    runId: 'run1',
    testCaseId: 'c1',
    title: null,
    status: 'PASSED',
    actualResult: null,
    notes: null,
    executedAt: '2026-09-18T10:05:00.000Z',
    executedBy: { id: 'u1', name: 'Amina' },
    testCase: loginCase,
    ...over,
  };
}

function automatedRun(over: Partial<RunDetail>, results: RunResult[] = []): RunDetail {
  return {
    id: 'run1',
    projectId: 'p1',
    name: 'Automated run',
    build: null,
    environment: null,
    type: 'AUTOMATED',
    status: 'COMPLETED',
    startedAt: '2026-09-18T10:00:00.000Z',
    completedAt: '2026-09-18T10:06:00.000Z',
    branch: 'main',
    pipelineId: 123,
    pipelineWebUrl: 'https://git.ejad.net/mobile/ninja-store/-/pipelines/123',
    pipelineStatus: 'success',
    note: null,
    project: { id: 'p1', key: 'NINJA', name: 'Ninja Store' },
    createdBy: { id: 'u1', name: 'Amina' },
    summary: summarizeResults(results),
    results,
    ...over,
  };
}

describe('Automated run screen', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the branch and a live pipeline link while the pipeline runs, without manual controls', () => {
    mockRoutes({});
    renderWithClient(<RunExecution run={automatedRun({ status: 'IN_PROGRESS', completedAt: null, pipelineStatus: 'running' })} />);

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pipeline #123' })).toHaveAttribute(
      'href',
      'https://git.ejad.net/mobile/ninja-store/-/pipelines/123',
    );
    expect(screen.getByText(/Results arrive from GitLab when the pipeline finishes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete run' })).not.toBeInTheDocument();
  });

  it("shows the importer's note on a finished run", () => {
    mockRoutes({});
    const jobUrl = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55';
    renderWithClient(<RunExecution run={automatedRun({ pipelineStatus: 'failed', note: `Pipeline finished without a test report – ${jobUrl}` })} />);

    expect(screen.getByText(/Pipeline finished without a test report/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: jobUrl })).toHaveAttribute('href', jobUrl);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/This run is completed/)).toBeInTheDocument();
  });

  it('links a failed result to its job artifacts and the Playwright report', async () => {
    mockRoutes({});
    const failed = result({
      status: 'FAILED',
      errorMessage: 'expect(received).toBe(expected)',
      durationMs: 4200,
      file: 'e2e/auth/login.spec.ts',
      artifactsUrl: 'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/browse',
    });
    const user = userEvent.setup();
    renderWithClient(<RunExecution run={automatedRun({ pipelineStatus: 'failed' }, [failed])} />);

    expect(screen.getByRole('link', { name: 'Artifacts' })).toHaveAttribute('href', failed.artifactsUrl);
    await user.click(screen.getByRole('button', { name: /TC-AUTH-001/ }));
    expect(screen.getByText('expect(received).toBe(expected)')).toBeInTheDocument();
    expect(screen.getByText(/4\.2 s/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Playwright HTML report' })).toHaveAttribute(
      'href',
      'https://git.ejad.net/mobile/ninja-store/-/jobs/55/artifacts/file/playwright-report/index.html',
    );
  });

  it('creates a test case from an unlinked result', async () => {
    const unlinked = result({
      id: 'r2',
      testCaseId: null,
      testCase: null,
      title: 'checkout pays with card @smoke',
      file: 'e2e/checkout/pay.spec.ts',
    });
    const { callsTo } = mockRoutes({
      'GET /projects/p1/modules': [
        { id: 'm1', name: 'Authentication', code: 'AUTH', caseCount: 3 },
        { id: 'm2', name: 'Checkout', code: 'CHK', caseCount: 0 },
      ],
      'POST /runs/run1/results/r2/create-case': {
        testCase: { id: 'c9', code: 'TC-CHK-001', name: 'checkout pays with card' },
        resultId: 'r2',
        tag: '@TC-CHK-001',
      },
    });
    const user = userEvent.setup();
    renderWithClient(<RunExecution run={automatedRun({}, [unlinked])} />);

    await user.click(screen.getByRole('button', { name: 'Create test case from this' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Test case name')).toHaveValue('checkout pays with card');
    await waitFor(() => expect(within(dialog).getByLabelText('Module')).toHaveValue('m2'));
    await user.click(within(dialog).getByRole('button', { name: 'Create test case' }));

    await waitFor(() => expect(callsTo('POST', '/runs/run1/results/r2/create-case')).toHaveLength(1));
    expect(callsTo('POST', '/runs/run1/results/r2/create-case')[0].body).toEqual({ name: 'checkout pays with card', moduleId: 'm2' });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Created TC-CHK-001. Add @TC-CHK-001 to the test's title so the next run links it."),
    );
  });
});
```

Run: `npm test -- automated-run`
Expected: FAIL. The first test cannot find the text "main", because the Phase 1 run screen shows no pipeline info yet.

- [ ] **Step 4: Pipeline badge, run info, result details and the create-case dialog**

`src/features/runs/pipeline-status-badge.tsx`:
```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pipelineStatusInfo, type PipelineTone } from './pipeline';

// Same token pattern as StatusBadge (tinted background, dark foreground) for AA contrast.
const TONE: Record<PipelineTone, string> = {
  passed: 'bg-status-passed/15 text-status-passed-fg',
  failed: 'bg-status-failed/15 text-status-failed-fg',
  running: 'bg-brand-blue/15 text-primary',
  pending: 'bg-status-pending/60 text-status-pending-fg',
  skipped: 'bg-status-skipped/15 text-status-skipped-fg',
};

export function PipelineStatusBadge({ status }: { status: string | null | undefined }) {
  const info = pipelineStatusInfo(status);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONE[info.tone])}
      title="GitLab pipeline status"
    >
      {info.tone === 'running' ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      <span className="sr-only">Pipeline </span>
      {info.label}
    </span>
  );
}
```

`src/features/runs/automated-run-info.tsx`:
```tsx
import { ExternalLink, GitBranch } from 'lucide-react';
import type { TestRun } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PipelineStatusBadge } from './pipeline-status-badge';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** The note with any URL in it (e.g. the job link after "Pipeline finished without a test report") made a link. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Branch, pipeline status + link and the importer's note of an automated run (spec §10). Renders nothing for manual runs. */
export function AutomatedRunInfo({ run, compact = false, className }: { run: TestRun; compact?: boolean; className?: string }) {
  if (run.type !== 'AUTOMATED') return null;
  const showStatus = !!run.pipelineStatus || run.status === 'IN_PROGRESS';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', compact ? 'text-xs' : 'text-sm', className)}>
      {run.branch && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Branch </span>
          <span className="font-mono">{run.branch}</span>
        </span>
      )}
      {showStatus && <PipelineStatusBadge status={run.pipelineStatus} />}
      {run.pipelineWebUrl && (
        <a href={run.pipelineWebUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Pipeline{run.pipelineId ? ` #${run.pipelineId}` : ''}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
      {run.note && (
        <p className={cn('basis-full text-status-blocked-fg', compact && 'truncate')} title={run.note}>
          <NoteText text={run.note} />
        </p>
      )}
    </div>
  );
}
```

`src/features/runs/automated-result-details.tsx`:
```tsx
import { ExternalLink } from 'lucide-react';
import { reportUrlFromArtifacts } from '@/features/gitlab/paths';
import type { RunResult } from '@/lib/types';
import { formatDuration } from './pipeline';

/** File, duration, error and GitLab artifact links of an automated result (spec §7: artifacts are linked, never copied). */
export function AutomatedResultDetails({ result }: { result: RunResult }) {
  const duration = formatDuration(result.durationMs);
  const artifactsUrl = result.status === 'FAILED' ? result.artifactsUrl : null;
  if (!result.file && !duration && !result.errorMessage && !artifactsUrl) return null;
  const reportUrl = artifactsUrl ? reportUrlFromArtifacts(artifactsUrl) : null;

  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      {(result.file || duration) && (
        <p className="text-xs text-muted-foreground">
          {result.file && <span className="font-mono">{result.file}</span>}
          {result.file && duration && ' · '}
          {duration}
        </p>
      )}
      {result.errorMessage && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Error</p>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-xs text-status-failed-fg">
            {result.errorMessage}
          </pre>
        </div>
      )}
      {artifactsUrl && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href={artifactsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Job artifacts (screenshots, traces)
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {reportUrl && (
            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Playwright HTML report
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
```

`src/features/runs/create-case-from-result-dialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModules } from '@/features/cases/api';
import { useCreateCaseFromResult } from '@/features/gitlab/api';
import { ApiError } from '@/lib/api';
import type { RunDetail, RunResult } from '@/lib/types';
import { caseNameFromTitle, guessModuleId } from './module-guess';

interface CreateCaseFromResultDialogProps {
  run: RunDetail;
  /** The Unlinked result to turn into a test case. The dialog is open while this is set. */
  result: RunResult | null;
  onClose: () => void;
}

export function CreateCaseFromResultDialog({ run, result, onClose }: CreateCaseFromResultDialogProps) {
  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">{result && <CreateCaseForm key={result.id} run={run} result={result} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CreateCaseForm({ run, result, onDone }: { run: RunDetail; result: RunResult; onDone: () => void }) {
  const modules = useModules(run.projectId);
  const create = useCreateCaseFromResult(run.id, run.projectId);
  const [name, setName] = useState(() => caseNameFromTitle(result.title));
  const [moduleId, setModuleId] = useState<string | null>(null);
  const list = modules.data ?? [];
  // Pre-filled from the test's file path until the user picks a module.
  const chosenModule = moduleId ?? guessModuleId(result.file, list);
  const canSubmit = !!name.trim() && !!chosenModule && !create.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const created = await create.mutateAsync({ resultId: result.id, input: { name: name.trim(), moduleId: chosenModule } });
      toast.success(`Created ${created.testCase.code}. Add ${created.tag} to the test's title so the next run links it.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the test case');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create test case from this</DialogTitle>
        <DialogDescription>Adds a test case for this automated test. You can fill in the steps and expected result later.</DialogDescription>
      </DialogHeader>
      <form id="create-case-from-result" onSubmit={submit} className="space-y-4">
        {result.file && <p className="break-all font-mono text-xs text-muted-foreground">{result.file}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="create-case-name">Test case name</Label>
          <Input id="create-case-name" maxLength={300} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-case-module">Module</Label>
          <select
            id="create-case-module"
            value={chosenModule}
            onChange={(e) => setModuleId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {list.length === 0 && <option value="">No modules yet. Add one on the Test Cases tab.</option>}
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code})
              </option>
            ))}
          </select>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="create-case-from-result" disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create test case'}
        </Button>
      </DialogFooter>
    </>
  );
}
```

- [ ] **Step 5: Wire them into the Phase 1 run screens**

These are targeted edits, because the fix wave also touched these files. Keep everything else as it is.

`src/features/runs/api.ts`: add `import { needsPipelinePolling, PIPELINE_POLL_MS } from './pipeline';` and replace `useRuns` and `useRun` with:
```ts
export function useRuns(projectId: string) {
  return useQuery({
    queryKey: runKeys.list(projectId),
    queryFn: () => api<RunListItem[]>(`/projects/${projectId}/runs`),
    enabled: !!projectId,
    // Automated runs change on GitLab's side. Refresh while any pipeline is still running (spec §7).
    refetchInterval: (query) => (query.state.data?.some(needsPipelinePolling) ? PIPELINE_POLL_MS : false),
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => api<RunDetail>(`/runs/${runId}`),
    refetchInterval: (query) => (needsPipelinePolling(query.state.data) ? PIPELINE_POLL_MS : false),
  });
}
```

`src/features/runs/run-list.tsx`: add `import { AutomatedRunInfo } from './automated-run-info';`, and in the first cell, directly after the `<p className="text-xs text-muted-foreground">…</p>` that shows "Automated/Manual · build · environment", add:
```tsx
                <AutomatedRunInfo run={run} compact className="mt-1" />
```

`src/features/runs/run-header.tsx`:
1. Add `import { AutomatedRunInfo } from './automated-run-info';`.
2. Directly after the `<p className="mt-1 text-sm text-muted-foreground">…</p>` that shows "started … by …", add:
```tsx
          <AutomatedRunInfo run={run} className="mt-2" />
```
3. The importer completes automated runs, so they get no Complete run button. Change the condition in front of the Complete run button from `run.status === 'IN_PROGRESS' &&` to `run.status === 'IN_PROGRESS' && run.type !== 'AUTOMATED' &&`. Keep any extra condition the fix wave added.

`src/features/runs/run-execution.tsx`:
1. Add `import { CreateCaseFromResultDialog } from './create-case-from-result-dialog';`, and add `RunResult` to the `@/lib/types` type import.
2. Replace `const readOnly = run.status === 'COMPLETED';` with:
```tsx
  // Automated results come from GitLab's test report. The importer owns them, so they are never edited here (spec §7).
  const automated = run.type === 'AUTOMATED';
  const readOnly = run.status === 'COMPLETED' || automated;
  const [createFrom, setCreateFrom] = useState<RunResult | null>(null);
```
3. Replace the read-only notice block (`{readOnly && ( <p role="status" …>This run is completed. Results are read-only.</p> )}`) with:
```tsx
      {automated && run.status === 'IN_PROGRESS' ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Results arrive from GitLab when the pipeline finishes. This page refreshes every 10 seconds.
        </p>
      ) : (
        readOnly && (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            This run is completed. Results are read-only.
          </p>
        )
      )}
```
4. On `<ResultRow … />`, add the prop:
```tsx
            onCreateCase={automated && !r.testCaseId ? () => setCreateFrom(r) : undefined}
```
5. Just before the component's closing `</div>`, add:
```tsx
      <CreateCaseFromResultDialog run={run} result={createFrom} onClose={() => setCreateFrom(null)} />
```

`src/features/runs/result-row.tsx`:
1. Add the imports `import { ExternalLink } from 'lucide-react';` (merge with the existing `lucide-react` import), `import { Button } from '@/components/ui/button';` and `import { AutomatedResultDetails } from './automated-result-details';`.
2. In `ResultRowProps`, add:
```tsx
  /** Set for Unlinked automated results: opens "Create test case from this". */
  onCreateCase?: () => void;
```
and add `onCreateCase` to the destructured props of `ResultRow`.
3. Directly after `{tc && <PriorityBadge priority={tc.priority} />}`, add:
```tsx
        {!tc && onCreateCase && (
          <Button type="button" size="sm" variant="outline" onClick={onCreateCase}>
            Create test case from this
          </Button>
        )}
```
4. In the right-hand column (the `<div className="flex w-40 flex-col items-end text-right" …>` that holds the `SaveIndicator`), after the `executedBy` span, add:
```tsx
          {result.status === 'FAILED' && result.artifactsUrl && (
            <a
              href={result.artifactsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Artifacts
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
```
5. In the expanded body, make `<AutomatedResultDetails result={result} />` the first child of the second column (the `<div className="space-y-3">` that holds "Actual result" and "Notes").

Run: `npm test -- automated-run run-execution result-row`
Expected: all pass (automated-run 4, plus the Phase 1 run-execution and result-row tests unchanged).

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 105 tests pass (96 + pipeline 3 + module guess 2 + automated run 4), and typecheck, lint and build succeed. If the API is running with a linked project and the CI job, smoke-check this flow:
1. Start Run tests. The run page shows the branch, a "Pending" or "Running" badge and "Pipeline #N". It refreshes every 10 s, with no Complete run button and no status buttons.
2. When the pipeline finishes, the run completes by itself. Tagged tests fill their cases, and failed ones have an **Artifacts** link. When expanded, they show the error, duration and a "Playwright HTML report" link.
3. An untagged test appears as Unlinked with **Create test case from this**. The dialog pre-fills the name and a module that matches its folder. After creating, the toast tells you the tag to add.
4. The Runs list shows the branch, pipeline badge and link, and the note for automated runs. A manual run still works exactly as before.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: automated run views with pipeline status, artifacts and create-case from unlinked

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: README and final verification

**Files:**
- Modify: `README.md` (add a "GitLab automation" section)

**Interfaces:**
- Consumes: everything above; the API Phase 2 build with `GITLAB_URL` set (for the manual check) and without it (for the Phase 1 e2e).
- Produces: a verified branch `feat/web-phase2-gitlab`: 105 unit/component tests pass with no warnings, typecheck, lint and build are clean, and the Phase 1 Playwright happy path still passes.

- [ ] **Step 1: README**

In `README.md`, add this section after "Local development":
````markdown
## GitLab automation

These features appear only when the API has GitLab configured (`GITLAB_URL` and the OAuth app; see "GitLab setup" in the API README). Without it, the app looks exactly like Phase 1.

- **Profile → GitLab:** each tester connects their own GitLab account. Everything the tool does in GitLab uses that account.
- **Project Settings → Repository** (admins): link the GitLab project, default branch, tests folder (e.g. `e2e`) and Playwright config.
- **Automation tab** (linked projects): browse the tests folder by branch and edit files in the Monaco editor. Save commits to your work branch `tests/<gitlab-username>-<work name>` and opens a merge request, never touching the default branch. The tab also shows coverage by `@TC-…` tags, the "Not automated yet" list, and the CI job to add to `.gitlab-ci.yml`.
- **Run tests** (Automation or Runs tab): starts a GitLab CI pipeline for a branch and scope. The automated run shows the pipeline status, refreshes every 10 s, and fills its results from GitLab's test report.

The editor is Monaco, served from `public/monaco`. `npm run dev` and `npm run build` copy it from `node_modules/monaco-editor` (the folder is git-ignored). If you add a Content-Security-Policy, allow `worker-src 'self' blob:` and `style-src 'self' 'unsafe-inline'` for the editor.
````

- [ ] **Step 2: Full verification**

```bash
cd /c/Users/User/StudioProjects/ejad-testcases-web
npm test && npm run typecheck && npm run lint && npm run build
```
Expected: 105 tests pass (51 Phase 1 + 54 in this plan: T1 20, T2 7, T3 5, T4 5, T5 3, T6 5, T7 9), and typecheck, lint (no warnings) and build succeed. The build prints "Copied Monaco editor to public/monaco/vs".

- [ ] **Step 3: Check that the test output is clean**

```bash
npm test 2>&1 | grep -iE "warning|not wrapped in act|not implemented|Missing .Description|aria-describedby" ; echo "grep exit: $?"
```
Expected: no matching lines and `grep exit: 1`. If anything matches, fix its cause (an unawaited state update, a dialog without a description, a jsdom API such as `scrollTo`) rather than silencing it.

- [ ] **Step 4: Phase 1 end-to-end still passes**

Start the API **without** `GITLAB_URL` (its normal dev `.env`), then:
```bash
npm run e2e
```
Expected: `1 passed`. The happy path must not see any GitLab UI. `/gitlab/status` answers `{ enabled: false }` and the tabs are unchanged.

- [ ] **Step 5: Manual check against GitLab (spec §1 success criteria)**

With the API Phase 2 running and pointed at git.ejad.net (or a test GitLab), and with a repository that contains the CI job from the Automation tab:
1. Profile → Connect GitLab → back on Profile with "GitLab connected" and `@username`.
2. As admin, Settings → Repository: link the project with tests folder `e2e`. The header shows the repo link, and the Automation tab appears.
3. Automation: open a spec and edit it. Save asks for a work name, then shows "Saved to tests/<you>-<slug>", the branch switches, and "Merge request !N · Open" opens the MR in GitLab (target = default branch; the description lists the file and the case codes).
4. Change the same file in GitLab, then save here again. The 409 banner appears, and Reload shows GitLab's version.
5. Coverage lists the tagged files and cases. "Not automated yet" lists the rest. Copy puts the CI YAML on the clipboard.
6. Run tests → your branch → All tests. The run page shows Pending → Running (refreshing every 10 s) and then completes by itself. Tagged tests fill their cases (Passed/Failed/Skipped, error, duration), failed ones link to Artifacts and the Playwright HTML report, and untagged ones are Unlinked with "Create test case from this".
7. Revoke the token in GitLab and reload. The Automation tab asks you to reconnect, and Profile shows "Needs reconnect" with Reconnect.
Record anything that fails in the task report with the API response you saw.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: GitLab automation in the web README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Next plan (not part of this plan)

**MCP AI test authoring** (`../ejad-testcases-api/docs/superpowers/specs/2026-09-18-mcp-ai-test-authoring-design.md`): AI drafts and suggestions review UI. When cases gain a review state there, "Not automated yet" keeps listing only what the API returns (approved cases), so this plan's UI needs no change for it.
