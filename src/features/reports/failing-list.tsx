import Link from 'next/link';
import { formatDateTime } from '@/lib/format';
import type { ProjectReport } from '@/lib/types';

export function FailingList({ projectKey, failing }: { projectKey: string; failing: ProjectReport['failing'] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Currently failing ({failing.length})</h3>
      {failing.length === 0 ? (
        <p className="text-sm text-muted-foreground">No failing test cases. 🎉</p>
      ) : (
        <ul className="divide-y">
          {failing.map((f) => (
            <li key={f.id} className="py-2.5">
              <Link href={`/projects/${projectKey}/cases/${f.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{f.code}</span> {f.name}
              </Link>
              {f.actualResult && <p className="line-clamp-2 text-sm text-status-failed-fg">{f.actualResult}</p>}
              <p className="text-xs text-muted-foreground">
                {f.module.name} · failed in{' '}
                <Link href={`/projects/${projectKey}/runs/${f.run.id}`} className="underline-offset-2 hover:underline">
                  {f.run.name}
                </Link>{' '}
                · {formatDateTime(f.executedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
