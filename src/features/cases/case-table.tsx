'use client';

import { Check, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { PriorityBadge } from '@/components/priority-badge';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TestCaseListItem } from '@/lib/types';
import { AiDraftBadge } from './ai-draft-badge';
import { isDraft } from './review';

interface CaseTableProps {
  projectKey: string;
  items: TestCaseListItem[];
  /** Ids of the selected drafts (only drafts are selectable — only they can be approved). */
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (draftIds: string[]) => void;
  onEdit: (testCase: TestCaseListItem) => void;
  onDelete: (testCase: TestCaseListItem) => void;
  onApprove: (testCase: TestCaseListItem) => void;
  onReject: (testCase: TestCaseListItem) => void;
  approving?: boolean;
}

export function CaseTable({
  projectKey,
  items,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  approving,
}: CaseTableProps) {
  const draftIds = items.filter(isDraft).map((tc) => tc.id);
  const selectedDraftCount = draftIds.filter((id) => selected.includes(id)).length;
  const allDraftsSelected = draftIds.length > 0 && selectedDraftCount === draftIds.length;
  const someDraftsSelected = selectedDraftCount > 0 && !allDraftsSelected;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all AI drafts on this page"
                checked={someDraftsSelected ? 'indeterminate' : allDraftsSelected}
                disabled={draftIds.length === 0}
                onCheckedChange={() => onToggleAll(draftIds)}
              />
            </TableHead>
            <TableHead className="w-32">ID</TableHead>
            <TableHead>Test case</TableHead>
            <TableHead className="w-40">Module</TableHead>
            <TableHead className="w-24">Priority</TableHead>
            <TableHead className="w-36">Latest status</TableHead>
            <TableHead className="w-48">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((tc) => {
            const draft = isDraft(tc);
            return (
              <TableRow key={tc.id} className={draft ? 'bg-primary/[0.03]' : undefined}>
                <TableCell>
                  {draft && (
                    <Checkbox aria-label={`Select ${tc.code}`} checked={selected.includes(tc.id)} onCheckedChange={() => onToggle(tc.id)} />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{tc.code}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects/${projectKey}/cases/${tc.id}`} className="font-medium hover:text-primary hover:underline">
                      {tc.name}
                    </Link>
                    {draft && <AiDraftBadge />}
                  </div>
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
                  <div className="flex items-center justify-end gap-1">
                    {draft && (
                      <>
                        <Button size="sm" aria-label={`Approve ${tc.code}`} disabled={approving} onClick={() => onApprove(tc)}>
                          <Check className="mr-1 h-4 w-4" aria-hidden />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Reject ${tc.code}`}
                          onClick={() => onReject(tc)}
                        >
                          <X className="mr-1 h-4 w-4" aria-hidden />
                          Reject
                        </Button>
                      </>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${tc.code}`}>
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(tc)}>Edit</DropdownMenuItem>
                        {!draft && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(tc)}>
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
