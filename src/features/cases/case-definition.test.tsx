import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TestCase } from '@/lib/types';
import { CaseDefinition } from './case-definition';

const tc = {
  code: 'TC-AUTH-004',
  name: 'Login with Magic Link (Success)',
  description: 'Verify magic link login',
  preconditions: null,
  steps: '1. Open Login\n2. Select Magic Link login',
  testData: 'Registered email',
  expectedResult: 'User is authenticated',
  notes: '',
} as TestCase;

describe('CaseDefinition', () => {
  it('renders every template field, keeping line breaks and marking empty ones', () => {
    render(<CaseDefinition testCase={tc} />);
    expect(screen.getByText('Test steps')).toBeInTheDocument();
    const steps = screen.getByText(/1\. Open Login/);
    expect(steps.textContent).toBe('1. Open Login\n2. Select Magic Link login');
    expect(steps).toHaveClass('whitespace-pre-wrap');
    expect(screen.getAllByText('—')).toHaveLength(2); // preconditions + notes
  });
});
