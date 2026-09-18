import Link from 'next/link';
import { StatusBar } from '@/components/status-bar';
import { formatRelative } from '@/lib/format';
import type { Dashboard } from '@/lib/types';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function DashboardOverview({ data }: { data: Dashboard }) {
  return (
    <section aria-label="Overview" className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-1 xl:grid-cols-3">
        <Stat label="Projects" value={data.projectCount} />
        <Stat label="Test cases" value={data.testCaseCount} />
        <Stat label="Runs in progress" value={data.runsInProgress} />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Recent runs</h2>
        {data.recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.recentRuns.map((run) => (
              <li key={run.id}>
                <Link href={`/projects/${run.project.key}/runs/${run.id}`} className="block rounded-md p-1 hover:bg-muted">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted-foreground">{run.project.key}</span> · {run.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(run.startedAt)}</span>
                  </div>
                  <StatusBar summary={run.summary} className="mt-1.5 h-1.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
