import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TestRun } from '@/lib/types';
import { AutomatedRunInfo } from './automated-run-info';

function run(over: Partial<TestRun>): TestRun {
  return {
    id: 'run1',
    projectId: 'p1',
    name: 'Automated run',
    build: null,
    environment: null,
    type: 'AUTOMATED',
    status: 'COMPLETED',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
    ...over,
  };
}

describe('AutomatedRunInfo note links', () => {
  it('links a URL followed by a period without including the period in the link', () => {
    const jobUrl = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55';
    render(<AutomatedRunInfo run={run({ note: `Pipeline finished without a test report – ${jobUrl}.` })} />);

    const link = screen.getByRole('link', { name: jobUrl });
    expect(link).toHaveAttribute('href', jobUrl);
    expect(screen.getByText(/\.$/)).toBeInTheDocument();
  });

  it('links a URL followed by other trailing punctuation without including it', () => {
    const jobUrl = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55';
    render(<AutomatedRunInfo run={run({ note: `See the job (${jobUrl}), then retry.` })} />);

    expect(screen.getByRole('link', { name: jobUrl })).toHaveAttribute('href', jobUrl);
  });

  it('links a bare URL with nothing after it', () => {
    const jobUrl = 'https://git.ejad.net/mobile/ninja-store/-/jobs/55';
    render(<AutomatedRunInfo run={run({ note: jobUrl })} />);

    expect(screen.getByRole('link', { name: jobUrl })).toHaveAttribute('href', jobUrl);
  });
});
