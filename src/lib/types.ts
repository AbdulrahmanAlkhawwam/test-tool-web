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
}

export interface RunDetail extends TestRun {
  project: { id: string; key: string; name: string };
  createdBy: UserRef;
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
