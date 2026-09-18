import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { CaseHistoryEntry } from '@/lib/types';

export function CaseHistory({ projectKey, history }: { projectKey: string; history: CaseHistoryEntry[] }) {
  if (!history.length) return <p className="text-sm text-muted-foreground">This test case hasn&apos;t been part of any run yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead>Actual result</TableHead>
            <TableHead className="w-44">Executed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h) => (
            <TableRow key={h.id}>
              <TableCell>
                <Link href={`/projects/${projectKey}/runs/${h.run.id}`} className="font-medium hover:text-primary hover:underline">
                  {h.run.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {h.run.type === 'AUTOMATED' ? 'Automated' : 'Manual'} · started {formatDateTime(h.run.startedAt)}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge status={h.status} />
              </TableCell>
              <TableCell className="max-w-md whitespace-pre-wrap text-sm">
                {h.actualResult || '—'}
                {h.notes && <p className="mt-1 text-xs text-muted-foreground">Note: {h.notes}</p>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {h.executedBy ? (
                  <>
                    {h.executedBy.name}
                    <br />
                    {formatDateTime(h.executedAt)}
                  </>
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
