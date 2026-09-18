'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BreakdownRow, STATUS_CHART_COLORS, STATUS_SERIES } from './chart-data';

export function BreakdownChart({ title, data }: { title: string; data: BreakdownRow[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No test cases yet.</p>
      ) : (
        <div style={{ height: Math.max(160, data.length * 36 + 60) }} role="img" aria-label={`${title}: latest status of test cases`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {STATUS_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="status" fill={STATUS_CHART_COLORS[s.key]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
