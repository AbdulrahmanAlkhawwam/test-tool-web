'use client';

import { FolderCog, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { ProjectDetail, TestCase, TestCaseListItem } from '@/lib/types';
import { CaseFilters as Filters, useApproveCase, useApproveCases, useCases, useDeleteCase, useDraftCount, useModules } from './api';
import { CaseFilters } from './case-filters';
import { CaseFormDialog } from './case-form-dialog';
import { CaseTable } from './case-table';
import { ModulesDialog } from './modules-dialog';
import { approvalMessage, isDraft, pruneSelection, summarizeApproval } from './review';

const PAGE_SIZE = 50;

const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);

export function CasesView({ project, actions }: { project: ProjectDetail; actions?: React.ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: PAGE_SIZE });
  const cases = useCases(project.id, filters);
  const modules = useModules(project.id);
  const moduleList = modules.data ?? project.modules;
  const draftCount = useDraftCount(project.id);
  const del = useDeleteCase(project.id);
  const approve = useApproveCase(project.id);
  const bulkApprove = useApproveCases(project.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | undefined>();
  const [modulesOpen, setModulesOpen] = useState(false);
  const [deleting, setDeleting] = useState<TestCase | null>(null);
  const [rejecting, setRejecting] = useState<TestCaseListItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const onFiltersChange = useCallback((next: Filters) => setFilters(next), []);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success(`${deleting.code} deleted`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete the test case');
    }
  }

  /** Rejecting a draft is a soft delete (spec §6): the ID is retired, never reused. */
  async function confirmReject() {
    if (!rejecting) return;
    try {
      await del.mutateAsync(rejecting.id);
      toast.success(`${rejecting.code} rejected`);
      setRejecting(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not reject the draft');
    }
  }

  async function approveOne(tc: TestCaseListItem) {
    try {
      await approve.mutateAsync(tc.id);
      toast.success(`${tc.code} approved`);
    } catch (e) {
      // 404/409 means someone else already handled it; the hook refetches so the row disappears.
      toast.error(e instanceof ApiError ? e.message : 'Could not approve the test case');
    }
  }

  async function approveSelected() {
    const ids = selected;
    if (!ids.length) return;
    try {
      const summary = summarizeApproval(ids, await bulkApprove.mutateAsync(ids));
      // Keep the failures selected so they can be looked at and retried.
      setSelected(summary.failed.map((f) => f.id));
      if (summary.failed.length) toast.error(approvalMessage(summary));
      else toast.success(approvalMessage(summary));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not approve the selected drafts');
    }
  }

  const data = cases.data;

  // Deleting the last case on the last page leaves that page empty: step back instead of showing
  // "No test cases found" while earlier pages still have some.
  const pageOverflow = !!data && data.total > 0 && data.items.length === 0 && filters.page > 1;
  useEffect(() => {
    if (pageOverflow) setFilters((f) => ({ ...f, page: f.page - 1 }));
  }, [pageOverflow]);

  // Paging or filtering swaps the rows, and a draft can be approved elsewhere (another tester, or the
  // AI) between refetches. Prune against the visible *draft* ids, not every visible id: once a row is no
  // longer a draft its checkbox stops rendering, so keying on all ids would leave it selected forever
  // with nothing on screen able to clear it (pruneSelection returns the same array when nothing changed).
  const visibleDraftKey = (data?.items ?? []).filter(isDraft).map((tc) => tc.id).join(',');
  useEffect(() => {
    setSelected((prev) => pruneSelection(prev, visibleDraftKey ? visibleDraftKey.split(',') : []));
  }, [visibleDraftKey]);

  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CaseFilters modules={moduleList} value={filters} onChange={onFiltersChange} draftCount={draftCount.data} />
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button variant="outline" onClick={() => setModulesOpen(true)}>
            <FolderCog className="mr-1.5 h-4 w-4" aria-hidden />
            Modules
          </Button>
          <Button onClick={openCreate} disabled={moduleList.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            New test case
          </Button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span role="status">
            {selected.length} AI {selected.length === 1 ? 'draft' : 'drafts'} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button size="sm" disabled={bulkApprove.isPending} onClick={() => void approveSelected()}>
              {bulkApprove.isPending ? 'Approving…' : 'Approve selected'}
            </Button>
          </div>
        </div>
      )}

      {moduleList.length === 0 ? (
        <EmptyState
          title="Add a module first"
          description="Test cases are grouped by module (e.g. Authentication → TC-AUTH-001). You can also import an Excel sheet."
          action={<Button onClick={() => setModulesOpen(true)}>Add module</Button>}
        />
      ) : cases.isPending ? (
        <LoadingState />
      ) : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => cases.refetch()} />
      ) : data!.items.length === 0 ? (
        <EmptyState
          title={filters.reviewState === 'AI_DRAFT' ? 'No AI drafts' : 'No test cases found'}
          description={
            filters.reviewState === 'AI_DRAFT'
              ? 'Ask your AI assistant for test cases, or turn the chip off to see every case.'
              : 'Change the filters or create a new test case.'
          }
        />
      ) : (
        <>
          <CaseTable
            projectKey={project.key}
            items={data!.items}
            selected={selected}
            onToggle={(id) => setSelected((prev) => toggleId(prev, id))}
            onToggleAll={(draftIds) =>
              setSelected((prev) => (draftIds.every((id) => prev.includes(id)) ? prev.filter((id) => !draftIds.includes(id)) : draftIds))
            }
            onEdit={(tc) => {
              setEditing(tc);
              setFormOpen(true);
            }}
            onDelete={setDeleting}
            onApprove={(tc) => void approveOne(tc)}
            onReject={setRejecting}
            approving={approve.isPending}
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {from}–{to} of {data!.total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={to >= data!.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <CaseFormDialog projectId={project.id} modules={moduleList} testCase={editing} open={formOpen} onOpenChange={setFormOpen} />
      <ModulesDialog projectId={project.id} modules={moduleList} open={modulesOpen} onOpenChange={setModulesOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.code}?`}
        description="It disappears from lists and new runs. Past run results keep it, and its ID is never reused."
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${rejecting?.code}?`}
        description="The draft is thrown away and its ID is never reused. The AI can write a new draft any time."
        confirmLabel="Reject"
        destructive
        pending={del.isPending}
        onConfirm={() => void confirmReject()}
      />
    </div>
  );
}
