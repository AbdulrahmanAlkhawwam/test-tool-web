'use client';

import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { PriorityBadge } from '@/components/priority-badge';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TestCaseListItem } from '@/lib/types';

interface CaseTableProps {
  projectKey: string;
  items: TestCaseListItem[];
  onEdit: (testCase: TestCaseListItem) => void;
  onDelete: (testCase: TestCaseListItem) => void;
}

export function CaseTable({ projectKey, items, onEdit, onDelete }: CaseTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">ID</TableHead>
            <TableHead>Test case</TableHead>
            <TableHead className="w-40">Module</TableHead>
            <TableHead className="w-24">Priority</TableHead>
            <TableHead className="w-36">Latest status</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((tc) => (
            <TableRow key={tc.id}>
              <TableCell className="font-mono text-xs">{tc.code}</TableCell>
              <TableCell>
                <Link href={`/projects/${projectKey}/cases/${tc.id}`} className="font-medium hover:text-primary hover:underline">
                  {tc.name}
                </Link>
                {tc.expectedResult && <p className="line-clamp-1 text-xs text-muted-foreground">Expected: {tc.expectedResult}</p>}
              </TableCell>
              <TableCell className="text-sm">{tc.module.name}</TableCell>
              <TableCell>
                <PriorityBadge priority={tc.priority} />
              </TableCell>
              <TableCell>
                <span title={tc.latestResult ? `Last result in "${tc.latestResult.runName}"` : 'Never executed'}>
                  <StatusBadge status={tc.latestResult?.status ?? 'NOT_EXECUTED'} />
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${tc.code}`}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(tc)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(tc)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
