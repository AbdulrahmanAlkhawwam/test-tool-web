import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockRoutes } from '@/test/fetch-routes';
import { caseDetail, caseItem, caseProject, suggestion } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import CaseDetailPage from './page';

const push = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const base = {
  'GET /projects/NINJA': caseProject,
  'GET /projects/p1/modules': caseProject.modules,
  // The real API sends no body at all for "no pending suggestion" — not the JSON text "null".
  'GET /test-cases/c1/suggestion': () => new Response(null, { status: 200 }),
};

const render = () => renderWithClient(<CaseDetailPage params={{ key: 'NINJA', caseId: 'c1' }} />);

describe('CaseDetailPage — AI drafts and suggestions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('approves the draft from its banner', async () => {
    const { toast } = await import('sonner');
    let approved = false;
    const { callsTo } = mockRoutes({
      ...base,
      'GET /test-cases/c1': () => json(200, caseDetail(approved ? {} : { reviewState: 'AI_DRAFT', createdVia: 'AI' })),
      'POST /test-cases/c1/approve': () => {
        approved = true;
        return json(200, caseItem('c1', 'TC-AUTH-001'));
      },
    });
    const user = userEvent.setup();
    render();

    expect(await screen.findByText(/This is an AI draft/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('TC-AUTH-001 approved'));
    await waitFor(() => expect(screen.queryByText(/This is an AI draft/)).not.toBeInTheDocument());
    expect(callsTo('POST', '/test-cases/c1/approve')).toHaveLength(1);
  });

  it('rejects the draft and returns to the list', async () => {
    const { toast } = await import('sonner');
    const { callsTo } = mockRoutes({
      ...base,
      'GET /test-cases/c1': caseDetail({ reviewState: 'AI_DRAFT', createdVia: 'AI' }),
      'DELETE /test-cases/c1': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    // The banner's Reject and the confirm dialog's Reject share a name: reach into the dialog.
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('TC-AUTH-001 rejected'));
    expect(callsTo('DELETE', '/test-cases/c1')).toHaveLength(1);
    expect(push).toHaveBeenCalledWith('/projects/NINJA/cases');
  });

  it('says who wrote the case via AI and who approved it', async () => {
    mockRoutes({
      ...base,
      'GET /test-cases/c1': caseDetail({
        createdVia: 'AI',
        createdBy: { id: 'u9', name: 'Amina' },
        approvedBy: { id: 'u2', name: 'Sara' },
        approvedAt: '2026-09-21T10:00:00.000Z',
      }),
    });
    render();

    expect(await screen.findByText(/Created by Amina via AI/)).toBeInTheDocument();
    expect(screen.getByText(/Approved by Sara/)).toBeInTheDocument();
    expect(screen.queryByText(/This is an AI draft/)).not.toBeInTheDocument();
  });

  it('keeps an open Edit dialog’s typed text when the case refetches underneath it', async () => {
    let reads = 0;
    mockRoutes({
      ...base,
      'GET /test-cases/c1': () => json(200, caseDetail(reads++ === 0 ? {} : { steps: '1. Open the new Login screen' })),
      // Also proves the panel is wired into the page at all.
      'GET /test-cases/c1/suggestion': () => json(200, suggestion()),
    });
    const user = userEvent.setup();
    const { queryClient } = render();

    expect(await screen.findByRole('heading', { name: 'Suggested changes by AI' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const name = await screen.findByLabelText('Test case name');
    await user.clear(name);
    await user.type(name, 'My unsaved title');

    // Exactly what approving a draft or accepting a suggestion does to this page: it refetches the
    // case. The dialog must keep what the tester typed (it resets only on open or on a new case id).
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['case'] });
    });

    expect(await screen.findByText('1. Open the new Login screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Test case name')).toHaveValue('My unsaved title');
  });

  it('keeps the draft banner status region announcement-only, with no buttons inside it', async () => {
    mockRoutes({
      ...base,
      'GET /test-cases/c1': caseDetail({ reviewState: 'AI_DRAFT', createdVia: 'AI' }),
    });
    render();

    // The page briefly renders its own role="status" loading indicator before the case loads: wait for
    // the banner text first, then find the status region that actually announces it.
    await screen.findByText(/This is an AI draft/);
    const status = screen.getByText(/This is an AI draft/).closest('[role="status"]') as HTMLElement;
    expect(status).not.toBeNull();
    // The live region must wrap only the announced text, not Approve/Reject — otherwise a screen reader
    // re-announcing the region on every change also re-announces the interactive controls (Task 6 review
    // carry-over). This must fail if role="status" moves back onto the banner's outer wrapper.
    expect(within(status).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });
});
