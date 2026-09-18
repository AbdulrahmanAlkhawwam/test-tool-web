import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProjectReport } from '@/lib/types';

export function useProjectReport(projectId: string) {
  return useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => api<ProjectReport>(`/projects/${projectId}/reports`),
    enabled: !!projectId,
  });
}
