import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProjectListItem } from '@/lib/types';
import { ProjectCard } from './project-card';

const base: ProjectListItem = {
  id: 'p1',
  name: 'Ninja Store',
  key: 'NINJA',
  description: 'E-commerce app',
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  caseCount: 40,
  latestRun: null,
  lastTestedAt: null,
};

describe('ProjectCard', () => {
  it('shows an untested project', () => {
    render(<ProjectCard project={base} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/projects/NINJA');
    expect(screen.getByText('Ninja Store')).toBeInTheDocument();
    expect(screen.getByText('40 test cases')).toBeInTheDocument();
    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(screen.getByText('Not tested yet')).toBeInTheDocument();
  });

  it('shows the latest run with its pass rate and status bar', () => {
    render(
      <ProjectCard
        project={{
          ...base,
          archivedAt: '2026-09-10T00:00:00.000Z',
          lastTestedAt: new Date().toISOString(),
          latestRun: {
            id: 'r1',
            name: 'Sprint 12',
            status: 'IN_PROGRESS',
            startedAt: '2026-09-15T00:00:00.000Z',
            summary: { total: 40, executed: 21, notExecuted: 19, passed: 18, failed: 2, blocked: 1, skipped: 0, passRate: 85.7 },
          },
        }}
      />,
    );
    expect(screen.getByText('Latest run · Sprint 12')).toBeInTheDocument();
    expect(screen.getByText('85.7% passed')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '18 passed, 2 failed, 1 blocked, 19 not executed' })).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText(/^Tested /)).toBeInTheDocument();
  });
});
