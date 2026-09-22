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
      {!!report.skippedFiles?.length && (
        <p className="mt-3 break-all text-xs text-muted-foreground">
          Not scanned (over 1 MB): {report.skippedFiles.join(', ')}
        </p>
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
