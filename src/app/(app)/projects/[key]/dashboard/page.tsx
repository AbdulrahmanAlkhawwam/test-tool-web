'use client';

import { ErrorState, LoadingState } from '@/components/page-state';
import { useProject } from '@/features/projects/api';
import { useProjectReport } from '@/features/reports/api';
import { BreakdownChart } from '@/features/reports/breakdown-chart';
import { toBreakdownData, toTrendData } from '@/features/reports/chart-data';
import { FailingList } from '@/features/reports/failing-list';
import { PassTrendChart } from '@/features/reports/pass-trend-chart';
import { PRIORITY_LABELS } from '@/lib/labels';

export default function DashboardPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  const report = useProjectReport(project.data?.id ?? '');
  if (!project.data) return null;
  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;

  const r = report.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-4 lg:col-span-2">
        <h3 className="mb-3 text-sm font-medium">Pass rate over the last {r.trend.length} runs</h3>
        <PassTrendChart data={toTrendData(r.trend)} />
      </section>
      <BreakdownChart title="By module" data={toBreakdownData(r.byModule, (m) => m.name)} />
      <BreakdownChart title="By priority" data={toBreakdownData(r.byPriority, (p) => PRIORITY_LABELS[p.priority])} />
      <div className="lg:col-span-2">
        <FailingList projectKey={project.data.key} failing={r.failing} />
      </div>
    </div>
  );
}
