'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState, LoadingState } from '@/components/page-state';
import { PriorityBadge } from '@/components/priority-badge';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { useCase, useDeleteCase, useModules } from '@/features/cases/api';
import { AiDraftBadge } from '@/features/cases/ai-draft-badge';
import { CaseDefinition } from '@/features/cases/case-definition';
import { CaseFormDialog } from '@/features/cases/case-form-dialog';
import { CaseHistory } from '@/features/cases/case-history';
import { DraftBanner } from '@/features/cases/draft-banner';
import { isDraft } from '@/features/cases/review';
import { SuggestionPanel } from '@/features/cases/suggestion-panel';
import { useProject } from '@/features/projects/api';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export default function CaseDetailPage({ params }: { params: { key: string; caseId: string } }) {
  const router = useRouter();
  const project = useProject(params.key);
  const testCase = useCase(params.caseId);
  const projectId = project.data?.id ?? '';
  const modules = useModules(projectId);
  const del = useDeleteCase(projectId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (testCase.isPending || !project.data) return <LoadingState />;
  if (testCase.isError) return <ErrorState error={testCase.error} onRetry={() => testCase.refetch()} />;

  const tc = testCase.data;
  const latest = tc.history.find((h) => h.status !== 'NOT_EXECUTED');
  const casesHref = `/projects/${project.data.key}/cases`;

  async function remove() {
    try {
      await del.mutateAsync(tc.id);
      toast.success(`${tc.code} deleted`);
      router.push(casesHref);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete the test case');
    }
  }

  return (
    <div className="space-y-6">
      <Link href={casesHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All test cases
      </Link>

      {tc.deletedAt && (
        <p role="status" className="rounded-md bg-status-blocked/15 px-3 py-2 text-sm text-status-blocked-fg">
          This test case was deleted on {formatDateTime(tc.deletedAt)}. It is kept for run history.
        </p>
      )}

      {isDraft(tc) && !tc.deletedAt && <DraftBanner testCase={tc} projectId={projectId} onRejected={() => router.push(casesHref)} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-sm text-muted-foreground">{tc.code}</p>
          <h2 className="text-xl font-semibold">{tc.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{tc.module.name}</span>
            <PriorityBadge priority={tc.priority} />
            <StatusBadge status={latest?.status ?? 'NOT_EXECUTED'} />
            {isDraft(tc) && <AiDraftBadge />}
          </div>
        </div>
        {!tc.deletedAt && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden />
              Edit
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Delete
            </Button>
          </div>
        )}
      </div>

      <section className="rounded-xl border bg-card p-5">
        <CaseDefinition testCase={tc} />
        <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
          Created by {tc.createdBy.name}
          {tc.createdVia === 'AI' ? ' via AI' : ''} on {formatDateTime(tc.createdAt)} · last updated by {tc.updatedBy.name} on{' '}
          {formatDateTime(tc.updatedAt)}
          {tc.approvedBy ? ` · Approved by ${tc.approvedBy.name} on ${formatDateTime(tc.approvedAt ?? null)}` : ''}
        </p>
      </section>

      {!tc.deletedAt && <SuggestionPanel caseId={tc.id} projectId={projectId} />}

      <section className="space-y-3">
        <h3 className="font-medium">Result history</h3>
        <CaseHistory projectKey={project.data.key} history={tc.history} />
      </section>

      <CaseFormDialog projectId={projectId} modules={modules.data ?? project.data.modules} testCase={tc} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${tc.code}?`}
        description="It disappears from lists and new runs. Past run results keep it, and its ID is never reused."
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
