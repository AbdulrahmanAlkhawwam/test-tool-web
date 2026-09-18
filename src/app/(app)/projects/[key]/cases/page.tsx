'use client';

import { useProject } from '@/features/projects/api';
import { CasesView } from '@/features/cases/cases-view';

export default function CasesPage({ params }: { params: { key: string } }) {
  const project = useProject(params.key);
  // The project layout renders loading/error states; this page only renders once the project is cached.
  return project.data ? <CasesView project={project.data} /> : null;
}
