'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import type { ModuleRef, Priority, ResultStatus } from '@/lib/types';
import type { CaseFilters as Filters } from './api';

const ALL = 'all';

interface CaseFiltersProps {
  modules: ModuleRef[];
  value: Filters;
  onChange: (next: Filters) => void;
}

export function CaseFilters({ modules, value, onChange }: CaseFiltersProps) {
  const [q, setQ] = useState(value.q ?? '');

  useEffect(() => {
    const id = setTimeout(() => {
      if ((value.q ?? '') !== q) onChange({ ...value, q: q || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(id);
  }, [q, value, onChange]);

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 1 });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input type="search" placeholder="Search ID, name, description" aria-label="Search test cases" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Select value={value.moduleId ?? ALL} onValueChange={(v) => set({ moduleId: v === ALL ? undefined : v })}>
        <SelectTrigger className="w-44" aria-label="Filter by module">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All modules</SelectItem>
          {modules.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.priority ?? ALL} onValueChange={(v) => set({ priority: v === ALL ? undefined : (v as Priority) })}>
        <SelectTrigger className="w-36" aria-label="Filter by priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {PRIORITY_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.status ?? ALL} onValueChange={(v) => set({ status: v === ALL ? undefined : (v as ResultStatus) })}>
        <SelectTrigger className="w-44" aria-label="Filter by latest status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any latest status</SelectItem>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
