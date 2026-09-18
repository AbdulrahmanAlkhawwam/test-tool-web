import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityBadge } from './priority-badge';
import { StatusBadge } from './status-badge';

describe('badges', () => {
  it('shows the status label', () => {
    render(<StatusBadge status="NOT_EXECUTED" />);
    expect(screen.getByText('Not Executed')).toBeInTheDocument();
  });

  it('shows the priority label', () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
