import Link from 'next/link';
import { StatusBar } from '@/components/status-bar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { RunListItem } from '@/lib/types';
import { AutomatedRunInfo } from './automated-run-info';

export function RunList({ projectKey, runs }: { projectKey: string; runs: RunListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-64">Progress</TableHead>
            <TableHead className="w-24 text-right">Pass rate</TableHead>
            <TableHead className="w-48">Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/projects/${projectKey}/runs/${run.id}`} className="font-medium hover:text-primary hover:underline">
                  {run.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[run.type === 'AUTOMATED' ? 'Automated' : 'Manual', run.build, run.environment].filter(Boolean).join(' · ')}
                </p>
                <AutomatedRunInfo run={run} compact className="mt-1" />
              </TableCell>
              <TableCell>
                {run.status === 'COMPLETED' ? <Badge variant="secondary">Completed</Badge> : <Badge className="bg-accent text-accent-foreground hover:bg-accent">In progress</Badge>}
              </TableCell>
              <TableCell>
                <StatusBar summary={run.summary} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.summary.executed} / {run.summary.total} executed
                  {run.summary.failed > 0 && ` · ${run.summary.failed} failed`}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.summary.executed ? `${run.summary.passRate}%` : '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(run.startedAt)}
                <br />
                by {run.createdBy.name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
