'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError, download } from '@/lib/api';
import type { ProjectDetail } from '@/lib/types';

export function ExportCasesButton({ project }: { project: ProjectDetail }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await download(`/projects/${project.id}/test-cases/export`, `${project.key}-test-cases.xlsx`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" disabled={busy} onClick={() => void run()}>
      <Download className="mr-1.5 h-4 w-4" aria-hidden />
      {busy ? 'Exporting…' : 'Export'}
    </Button>
  );
}
