'use client';

import { CasesView } from '@/features/cases/cases-view';
import { ExportCasesButton } from '@/features/cases/export-cases-button';
import { ImportDialog } from '@/features/cases/import-dialog';
import { useProject } from '@/features/projects/api';

export default function CasesPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  if (!project.data) return null; // the project layout shows loading/error
  return (
    <CasesView
      project={project.data}
      actions={
        <>
          <ImportDialog project={project.data} />
          <ExportCasesButton project={project.data} />
        </>
      }
    />
  );
}
