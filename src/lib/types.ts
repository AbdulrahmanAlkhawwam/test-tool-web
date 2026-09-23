export type Role = 'ADMIN' | 'TESTER';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ResultStatus = 'NOT_EXECUTED' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
export type RunStatus = 'IN_PROGRESS' | 'COMPLETED';
export type RunType = 'MANUAL' | 'AUTOMATED';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface PublicUser extends AuthUser {
  active: boolean;
  createdAt: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface RunSummary {
  total: number;
  executed: number;
  notExecuted: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  passRate: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  caseCount: number;
  latestRun: { id: string; name: string; status: RunStatus; startedAt: string; summary: RunSummary } | null;
  lastTestedAt: string | null;
}

export interface ModuleRef {
  id: string;
  name: string;
  code: string;
}

export interface ModuleSummary extends ModuleRef {
  caseCount: number;
}

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

export interface LatestResult {
  testCaseId: string;
  status: ResultStatus;
  actualResult: string | null;
  executedAt: string | null;
  runId: string;
  runName: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  moduleId: string;
  code: string;
  name: string;
  description: string | null;
  preconditions: string | null;
  steps: string | null;
  testData: string | null;
  expectedResult: string | null;
  priority: Priority;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /**
   * MCP spec §5–§6. Optional: responses from before the AI phase omit them, and a missing value means
   * an ordinary approved case written in the web app. Read them through `isDraft`, never by truthiness.
   */
  reviewState?: ReviewState;
  createdVia?: CreatedVia;
  module: ModuleRef;
}

export interface TestCaseListItem extends TestCase {
  latestResult: LatestResult | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CaseHistoryEntry {
  id: string;
  status: ResultStatus;
  actualResult: string | null;
  notes: string | null;
  executedAt: string | null;
  executedBy: UserRef | null;
  run: { id: string; name: string; type: RunType; status: RunStatus; startedAt: string };
}

export interface TestCaseDetail extends TestCase {
  createdBy: UserRef;
  updatedBy: UserRef;
  history: CaseHistoryEntry[];
  /** Set once a tester approved an AI draft (spec §6); null or absent on cases nobody had to approve. */
  approvedBy?: UserRef | null;
  approvedAt?: string | null;
}

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

export interface RunListItem extends TestRun {
  createdBy: UserRef;
  summary: RunSummary;
}

export type RunCase = Pick<
  TestCase,
  'id' | 'code' | 'name' | 'description' | 'preconditions' | 'steps' | 'testData' | 'expectedResult' | 'priority' | 'notes' | 'deletedAt' | 'module'
>;

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

export interface RunDetail extends TestRun {
  project: { id: string; key: string; name: string };
  createdBy: UserRef;
  triggeredBy?: UserRef | null;
  summary: RunSummary;
  results: RunResult[];
}

export type SelectionMode = 'ALL' | 'MODULES' | 'PRIORITIES' | 'CASES';

export interface RunSelection {
  mode: SelectionMode;
  moduleIds?: string[];
  priorities?: Priority[];
  caseIds?: string[];
}

export interface ImportRow {
  rowNumber: number;
  code: string | null;
  moduleName: string;
  moduleCode: string;
  name: string;
  priority: Priority;
  status: ResultStatus;
  actualResult: string | null;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
}

export interface ImportPreview {
  importId: string;
  rows: ImportRow[];
  summary: { total: number; valid: number; withErrors: number; duplicates: number };
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  runId: string | null;
}

export interface ProjectReport {
  trend: { id: string; name: string; type: RunType; status: RunStatus; startedAt: string; summary: RunSummary }[];
  byModule: { moduleId: string; name: string; code: string; summary: RunSummary }[];
  byPriority: { priority: Priority; summary: RunSummary }[];
  failing: {
    id: string;
    code: string;
    name: string;
    module: ModuleRef;
    actualResult: string | null;
    executedAt: string | null;
    run: { id: string; name: string };
  }[];
}

export interface Dashboard {
  projectCount: number;
  testCaseCount: number;
  runsInProgress: number;
  recentRuns: {
    id: string;
    name: string;
    type: RunType;
    status: RunStatus;
    startedAt: string;
    project: { id: string; key: string; name: string };
    summary: RunSummary;
  }[];
}

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

/**
 * POST /gitlab/oauth/complete: the web calls this from /gitlab/callback (GitLab redirects there, not to
 * the API) with the query params GitLab gave back. `code` is absent when GitLab reports `error` instead.
 */
export interface GitlabOauthCompleteInput {
  code?: string;
  state: string;
  error?: string;
}

export interface GitlabOauthCompleteResult {
  status: 'connected';
  username: string;
}

/** `details.reason` on the 400 from /gitlab/oauth/complete. */
export type GitlabOauthFailureReason = 'invalid_state' | 'denied' | 'exchange_failed' | 'already_linked';

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
  /** True when this file opens read-only here: over 1 MB, not a recognized text extension, or not UTF-8 (spec §6). */
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
  /** Null when the save succeeded but opening/updating the merge request failed; retried on the next save. */
  mergeRequest: MergeRequestRef | null;
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
  /** Repository-relative paths of files over 1 MB that the scan skipped, if any. */
  skippedFiles?: string[];
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

// ---- AI test authoring (MCP spec §4–§9) ----

export type ReviewState = 'APPROVED' | 'AI_DRAFT';
export type CreatedVia = 'WEB' | 'IMPORT' | 'AI';
export type ApiTokenPurpose = 'MCP';

/** Personal access token expiry choices (spec §4). 90 is the default. */
export type TokenExpiryDays = 30 | 90 | 180;

/** GET /users/me/tokens. The token value itself is never in this shape — only its visible prefix. */
export interface ApiToken {
  id: string;
  name: string;
  /** Phase 2 of the API adds RUNNER; absent on older responses. */
  purpose?: ApiTokenPurpose;
  /** The 8 visible characters the API stores next to the hash (spec §4). */
  prefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** POST /users/me/tokens body. */
export interface CreateTokenInput {
  name: string;
  expiresInDays: TokenExpiryDays;
}

/**
 * POST /users/me/tokens response: the same meta the list returns plus the full `ejad_pat_…` value,
 * which the API sends exactly once. It must never be cached, stored, logged or put in a URL (spec §4).
 */
export interface CreatedToken extends ApiToken {
  token: string;
}

/** Template fields an AI suggestion may change (spec §5: template fields only). */
export type SuggestionField =
  | 'name'
  | 'description'
  | 'preconditions'
  | 'steps'
  | 'testData'
  | 'expectedResult'
  | 'priority'
  | 'notes';

/** `from` is the value when the AI read the case, `to` is what it proposes. */
export interface SuggestionChange {
  from: string | null;
  to: string | null;
}

export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/**
 * GET /test-cases/:id/suggestion — the one pending suggestion, or null (spec §6, §9).
 * `status` and `testCaseId` are optional: the endpoint's current select clause omits both, so a response
 * only ever carries a pending suggestion in practice. Never gate on their absence meaning something other
 * than "pending" — see `SuggestionPanel`, which renders unless `status` is present and not `PENDING`.
 */
export interface TestCaseSuggestion {
  id: string;
  testCaseId?: string;
  changes: Partial<Record<SuggestionField, SuggestionChange>>;
  status?: SuggestionStatus;
  rationale: string | null;
  createdBy: UserRef;
  createdAt: string;
}

/**
 * POST /test-cases/approve response. Both fields are optional: the API may report only the failures,
 * only the approved ids, or neither (everything approved). `summarizeApproval` normalizes it.
 */
export interface BulkApproveResult {
  approved?: string[];
  failed?: { id: string; message: string }[];
}
