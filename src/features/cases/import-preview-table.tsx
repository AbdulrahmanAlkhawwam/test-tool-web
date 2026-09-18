import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ImportPreview } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ImportPreviewTable({ preview }: { preview: ImportPreview }) {
  const { summary } = preview;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{summary.total} rows</Badge>
        <Badge className="bg-status-passed/15 text-status-passed-fg hover:bg-status-passed/15">{summary.valid} ready</Badge>
        {summary.withErrors > 0 && (
          <Badge className="bg-status-failed/15 text-status-failed-fg hover:bg-status-failed/15">{summary.withErrors} with errors</Badge>
        )}
        {summary.duplicates > 0 && (
          <Badge className="bg-status-blocked/20 text-status-blocked-fg hover:bg-status-blocked/20">{summary.duplicates} already exist</Badge>
        )}
      </div>
      <div className="max-h-80 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead className="w-32">ID</TableHead>
              <TableHead>Test case</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead>Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((r) => {
              const hasErrors = r.errors.length > 0;
              return (
                <TableRow key={r.rowNumber} data-state={hasErrors ? 'error' : 'ok'} className={cn(hasErrors && 'bg-status-failed/5')}>
                  <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.code ?? <Badge variant="outline">New ID</Badge>}
                    {r.duplicate && (
                      <Badge variant="outline" className="ml-1 border-status-blocked/50 text-status-blocked-fg">
                        Exists
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.name || <span className="text-muted-foreground">(no name)</span>}
                    <p className="text-xs text-muted-foreground">
                      {r.moduleName} ({r.moduleCode})
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="space-y-0.5 text-xs">
                    {r.errors.map((e) => (
                      <p key={e} className="text-status-failed-fg">
                        {e}
                      </p>
                    ))}
                    {r.warnings.map((w) => (
                      <p key={w} className="text-status-blocked-fg">
                        {w}
                      </p>
                    ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
