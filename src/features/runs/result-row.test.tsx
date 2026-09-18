import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { RunResult } from '@/lib/types';
import { ResultRow } from './result-row';

const result: RunResult = {
  id: 'r1',
  runId: 'run1',
  testCaseId: 'c1',
  title: null,
  status: 'NOT_EXECUTED',
  actualResult: null,
  notes: null,
  executedAt: null,
  executedBy: null,
  testCase: {
    id: 'c1',
    code: 'TC-AUTH-004',
    name: 'Login with Magic Link (Success)',
    description: null,
    preconditions: 'User can access email',
    steps: '1. Open Login\n2. Select Magic Link login',
    testData: 'Registered email',
    expectedResult: 'User is authenticated and redirected',
    priority: 'HIGH',
    notes: null,
    deletedAt: null,
    module: { id: 'm1', name: 'Authentication', code: 'AUTH' },
  },
};

function setup(onSave = vi.fn().mockResolvedValue({ ...result }), readOnly = false) {
  const user = userEvent.setup();
  render(<ResultRow result={result} readOnly={readOnly} onSave={onSave} expanded onExpandedChange={() => undefined} />);
  return { user, onSave };
}

describe('ResultRow', () => {
  it('shows the case definition next to the result fields', () => {
    setup();
    expect(screen.getByText('TC-AUTH-004')).toBeInTheDocument();
    expect(screen.getByText('User is authenticated and redirected')).toBeInTheDocument();
    expect(screen.getByLabelText('Actual result')).toBeInTheDocument();
  });

  it('saves a status immediately and shows Saved ✓', async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole('radio', { name: 'Failed' }));
    expect(onSave).toHaveBeenCalledWith({ status: 'FAILED' });
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Failed' })).toBeChecked();
  });

  it('saves the actual result on blur', async () => {
    const { user, onSave } = setup();
    await user.type(screen.getByLabelText('Actual result'), 'Opens a new tab');
    await user.tab();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ actualResult: 'Opens a new tab' }));
  });

  it('keeps typed text and offers a retry when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...result });
    const { user } = setup(onSave);
    await user.type(screen.getByLabelText('Notes'), 'Only on Safari');
    await user.tab();
    const retry = await screen.findByRole('button', { name: 'Not saved – retry' });
    expect(screen.getByLabelText('Notes')).toHaveValue('Only on Safari');
    await user.click(retry);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(onSave).toHaveBeenLastCalledWith({ notes: 'Only on Safari' });
  });

  it('shows why the server rejected a save and keeps the text', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new ApiError(409, { statusCode: 409, error: 'Conflict', message: 'Run is completed – results are read-only' }));
    const { user } = setup(onSave);
    await user.type(screen.getByLabelText('Notes'), 'Only on Safari');
    await user.tab();
    expect(await screen.findByText(/Run is completed – results are read-only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not saved – retry' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('Only on Safari');
  });

  it('limits the text fields to what the server accepts', () => {
    setup();
    expect(screen.getByLabelText('Actual result')).toHaveAttribute('maxLength', '10000');
    expect(screen.getByLabelText('Notes')).toHaveAttribute('maxLength', '5000');
  });

  it('is read-only for completed runs', () => {
    setup(undefined, true);
    expect(screen.getByRole('radio', { name: 'Passed' })).toBeDisabled();
    expect(screen.getByLabelText('Actual result')).toHaveAttribute('readonly');
  });

  it('does not let a stale cache update (from a slow save) erase newer unsaved text', async () => {
    // The first save never resolves during this test, standing in for a slow request that is
    // still in flight when a stale cache write for the same field arrives.
    const onSave = vi.fn().mockImplementationOnce(() => new Promise(() => undefined));
    const user = userEvent.setup();
    const { rerender } = render(<ResultRow result={result} readOnly={false} onSave={onSave} expanded onExpandedChange={() => undefined} />);

    const textarea = screen.getByLabelText('Actual result');
    await user.type(textarea, 'Opens');
    await user.tab(); // blur -> immediate flush; save #1 starts and hangs
    expect(onSave).toHaveBeenCalledWith({ actualResult: 'Opens' });

    await user.type(textarea, ' a new tab');
    await user.tab(); // blur again while save #1 is still pending

    // Simulate the cache write: a stale response for the earlier text lands and the parent
    // re-renders this row with the OLDER actualResult.
    rerender(<ResultRow result={{ ...result, actualResult: 'Opens' }} readOnly={false} onSave={onSave} expanded onExpandedChange={() => undefined} />);

    expect(screen.getByLabelText('Actual result')).toHaveValue('Opens a new tab');
  });
});
