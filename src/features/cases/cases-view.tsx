'use client';

import { FolderCog, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { ProjectDetail, TestCase } from '@/lib/types';
import { CaseFilters as Filters, useCases, useDeleteCase, useModules } from './api';
import { CaseFilters } from './case-filters';
import { CaseFormDialog } from './case-form-dialog';
import { CaseTable } from './case-table';
import { ModulesDialog } from './modules-dialog';

const PAGE_SIZE = 50;

export function CasesView({ project, actions }: { project: ProjectDetail; actions?: React.ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: PAGE_SIZE });
  const cases = useCases(project.id, filters);
  const modules = useModules(project.id);
  const moduleList = modules.data ?? project.modules;
  const del = useDeleteCase(project.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | undefined>();
  const [modulesOpen, setModulesOpen] = useState(false);
  const [deleting, setDeleting] = useState<TestCase | null>(null);
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

  const data = cases.data;
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CaseFilters modules={moduleList} value={filters} onChange={onFiltersChange} />
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
        <EmptyState title="No test cases found" description="Change the filters or create a new test case." />
      ) : (
        <>
          <CaseTable
            projectKey={project.key}
            items={data!.items}
            onEdit={(tc) => {
              setEditing(tc);
              setFormOpen(true);
            }}
            onDelete={setDeleting}
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
    </div>
  );
}
