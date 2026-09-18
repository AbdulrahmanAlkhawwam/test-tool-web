import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunSummary } from '@/lib/types';
import { describeSummary, StatusBar } from './status-bar';

const summary: RunSummary = { total: 40, executed: 21, notExecuted: 19, passed: 18, failed: 2, blocked: 1, skipped: 0, passRate: 85.7 };
const empty: RunSummary = { total: 0, executed: 0, notExecuted: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, passRate: 0 };

describe('StatusBar', () => {
  it('describes non-zero counts in a fixed order', () => {
    expect(describeSummary(summary)).toBe('18 passed, 2 failed, 1 blocked, 19 not executed');
    expect(describeSummary(empty)).toBe('No results yet');
  });

  it('renders proportional segments and skips empty ones', () => {
    const { container } = render(<StatusBar summary={summary} />);
    expect(screen.getByRole('img', { name: '18 passed, 2 failed, 1 blocked, 19 not executed' })).toBeInTheDocument();
    const passed = container.querySelector('[data-segment="passed"]') as HTMLElement;
    expect(passed.style.width).toBe('45%');
    expect(container.querySelector('[data-segment="skipped"]')).toBeNull();
  });

  it('renders an empty bar with no segments', () => {
    const { container } = render(<StatusBar summary={empty} />);
    expect(screen.getByRole('img', { name: 'No results yet' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0);
  });
});
