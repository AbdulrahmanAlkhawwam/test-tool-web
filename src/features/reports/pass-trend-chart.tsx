'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from './chart-data';

export function PassTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  return (
    <div className="h-64" role="img" aria-label={`Pass rate across ${data.length} runs`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} width={44} />
          <Tooltip
            formatter={(value) => (value === null ? 'Nothing executed' : `${value}%`)}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload as TrendPoint | undefined;
              return p ? `${label} · ${p.executed}/${p.total} executed` : String(label);
            }}
          />
          <Line type="monotone" dataKey="passRate" name="Pass rate" stroke="#2F6A94" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
