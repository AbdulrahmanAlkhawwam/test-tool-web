import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, json, mockRoutes } from '@/test/fetch-routes';
import { caseItem, suggestion } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { SuggestionPanel } from './suggestion-panel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const STALE = 'The test case changed since this suggestion – review it again';

describe('SuggestionPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('lists each field old → new with the rationale, and accepts it', async () => {
    const { toast } = await import('sonner');
    const { callsTo } = mockRoutes({
      'GET /test-cases/c1/suggestion': suggestion({
        changes: {
          steps: { from: '1. Open Login', to: '1. Open Login\n2. Tap Forgot password' },
          priority: { from: 'MEDIUM', to: 'HIGH' },
          notes: { from: null, to: 'Covers the new link' },
        },
      }),
      'POST /suggestions/s1/accept': caseItem('c1', 'TC-AUTH-001'),
    });
    const user = userEvent.setup();
    renderWithClient(<SuggestionPanel caseId="c1" projectId="p1" />);

    expect(await screen.findByRole('heading', { name: 'Suggested changes by AI' })).toBeInTheDocument();
    expect(screen.getByText('Test steps')).toBeInTheDocument();
    expect(screen.getByText('1. Open Login')).toBeInTheDocument();
    // getByText normalizes whitespace, so match the new line with a regex and check the raw text.
    const next = screen.getByText(/2\. Tap Forgot password/);
    expect(next.textContent).toBe('1. Open Login\n2. Tap Forgot password');
    expect(next).toHaveClass('whitespace-pre-wrap');
    // Priority reads as a label, not as an enum value.
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    // An empty old value is an em dash, not "null".
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('The Login screen now has a Forgot password link.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suggestion applied'));
    expect(callsTo('POST', '/suggestions/s1/accept')).toHaveLength(1);
  });

  it('shows the API’s stale message on a 409 and redraws with the case’s current values', async () => {
    const { toast } = await import('sonner');
    let reads = 0;
    mockRoutes({
      'GET /test-cases/c1/suggestion': () =>
        json(
          200,
          suggestion({
            changes: { steps: { from: reads++ === 0 ? '1. Open Login' : '1. Open the new Login screen', to: '1. Open Login\n2. Tap Forgot password' } },
          }),
        ),
      'POST /suggestions/s1/accept': () => apiError(409, STALE),
    });
    const user = userEvent.setup();
    renderWithClient(<SuggestionPanel caseId="c1" projectId="p1" />);

    await user.click(await screen.findByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(STALE));
    // The hook refetched, so the panel now shows what the case really says.
    expect(await screen.findByText('1. Open the new Login screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
  });

  it('shows nothing when there is no pending suggestion, and disappears after Reject', async () => {
    const { toast } = await import('sonner');
    let rejected = false;
    const { callsTo } = mockRoutes({
      'GET /test-cases/c1/suggestion': () => json(200, rejected ? null : suggestion()),
      'POST /suggestions/s1/reject': () => {
        rejected = true;
        return new Response(null, { status: 204 });
      },
    });
    const user = userEvent.setup();
    renderWithClient(<SuggestionPanel caseId="c1" projectId="p1" />);

    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suggestion rejected'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Suggested changes by AI' })).not.toBeInTheDocument());
    expect(callsTo('POST', '/suggestions/s1/reject')).toHaveLength(1);
  });
});
