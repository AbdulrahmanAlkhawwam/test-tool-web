import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockRoutes, type MockCall } from '@/test/fetch-routes';
import { caseItem, caseProject, pagedCases } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { CasesView } from './cases-view';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const draft = caseItem('c1', 'TC-AUTH-001', { reviewState: 'AI_DRAFT', createdVia: 'AI' });
const draft2 = caseItem('c2', 'TC-AUTH-002', { reviewState: 'AI_DRAFT', createdVia: 'AI' });
const approved = caseItem('c3', 'TC-AUTH-003');

/** One route for both the list and the "AI drafts (N)" count, which differ only by query. */
const casesRoute = (pages: Record<string, ReturnType<typeof pagedCases>>, draftTotal: number) => (call: MockCall) => {
  if (call.query.pageSize === '1') return pagedCases([], { total: draftTotal, pageSize: 1 });
  if (call.query.reviewState === 'AI_DRAFT') return pagedCases([draft, draft2], { total: draftTotal });
  return pages[call.query.page ?? '1'] ?? pages['1'];
};

const modulesRoute = { 'GET /projects/p1/modules': caseProject.modules };

describe('CasesView — AI drafts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('badges draft rows and offers Approve and Reject on them only', async () => {
    mockRoutes({ ...modulesRoute, 'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, approved]) }, 1) });
    renderWithClient(<CasesView project={caseProject} />);

    expect(await screen.findByText('TC-AUTH-001')).toBeInTheDocument();
    expect(screen.getByText('AI draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve TC-AUTH-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject TC-AUTH-001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve TC-AUTH-003' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select TC-AUTH-001' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select TC-AUTH-003' })).not.toBeInTheDocument();
  });

  it('filters to the drafts with the chip, which shows how many there are', async () => {
    const { callsTo } = mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, approved]) }, 2),
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    const chip = await screen.findByRole('button', { name: 'AI drafts (2)' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);

    expect(await screen.findByText('TC-AUTH-002')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('TC-AUTH-003')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'AI drafts (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(callsTo('GET', '/projects/p1/test-cases').some((c) => c.query.reviewState === 'AI_DRAFT' && c.query.pageSize === '50')).toBe(true);
  });

  it('approves one draft and says so', async () => {
    const { toast } = await import('sonner');
    mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, approved]) }, 1),
      'POST /test-cases/c1/approve': caseItem('c1', 'TC-AUTH-001'),
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('button', { name: 'Approve TC-AUTH-001' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('TC-AUTH-001 approved'));
  });

  it('shows the API’s message when a draft was already approved elsewhere, and refreshes the list', async () => {
    const { toast } = await import('sonner');
    let approvedElsewhere = false;
    const { callsTo } = mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': (call) =>
        call.query.pageSize === '1'
          ? pagedCases([], { total: approvedElsewhere ? 0 : 1, pageSize: 1 })
          : pagedCases(approvedElsewhere ? [approved] : [draft, approved]),
      'POST /test-cases/c1/approve': () => {
        approvedElsewhere = true;
        return apiError(404, 'Test case not found');
      },
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('button', { name: 'Approve TC-AUTH-001' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Test case not found'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve TC-AUTH-001' })).not.toBeInTheDocument());
    expect(callsTo('GET', '/projects/p1/test-cases').length).toBeGreaterThan(2);
  });

  it('bulk approves the selection and reports the drafts that failed', async () => {
    const { toast } = await import('sonner');
    const { callsTo } = mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, draft2, approved]) }, 2),
      'POST /test-cases/approve': { approved: ['c1'], failed: [{ id: 'c2', message: 'TC-AUTH-002 was already approved' }] },
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Select all AI drafts on this page' }));
    expect(await screen.findByText('2 AI drafts selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve selected' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('1 approved, 1 failed: TC-AUTH-002 was already approved'));
    expect(callsTo('POST', '/test-cases/approve')[0].body).toEqual({ ids: ['c1', 'c2'] });
    // The one that failed stays selected so it can be retried; the one that worked does not.
    expect(await screen.findByText('1 AI draft selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select TC-AUTH-002' })).toBeChecked();
  });

  it('drops a selection that is no longer on screen when the tester pages on', async () => {
    mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute(
        {
          '1': pagedCases([draft, draft2], { total: 3, pageSize: 2, page: 1 }),
          '2': pagedCases([approved], { total: 3, pageSize: 2, page: 2 }),
        },
        2,
      ),
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Select TC-AUTH-001' }));
    expect(await screen.findByText('1 AI draft selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('TC-AUTH-003')).toBeInTheDocument();
    // An exact string, not a regex: a substring regex also matches the bar's wrapper element.
    await waitFor(() => expect(screen.queryByText('1 AI draft selected')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Approve selected' })).not.toBeInTheDocument();
  });

  it('drops a selected row that comes back approved while still on the page, with no checkbox left to clear it', async () => {
    let approvedNow = false;
    mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': (call) => {
        if (call.query.pageSize === '1') return pagedCases([], { total: approvedNow ? 0 : 1, pageSize: 1 });
        const row = approvedNow ? caseItem('c1', 'TC-AUTH-001') : draft;
        return pagedCases([row, approved]);
      },
    });
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Select TC-AUTH-001' }));
    expect(await screen.findByText('1 AI draft selected')).toBeInTheDocument();

    // Someone else (another tester, or the AI accepting its own suggestion) approves the same case; the
    // list refetches with the row still on screen but no longer a draft.
    approvedNow = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
    });

    await waitFor(() => expect(screen.queryByText(/AI draft(s)? selected/)).not.toBeInTheDocument());
    expect(screen.queryByRole('checkbox', { name: 'Select TC-AUTH-001' })).not.toBeInTheDocument();
  });

  it('shows the header checkbox as indeterminate when only some drafts on the page are selected', async () => {
    mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, draft2, approved]) }, 2),
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Select TC-AUTH-001' }));

    const headerCheckbox = screen.getByRole('checkbox', { name: 'Select all AI drafts on this page' });
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'mixed');
    // Radix marks the mixed state with data-state="indeterminate"; the checkbox styles that state the
    // same as checked so the header control doesn't look unstyled/broken (Task 6 review carry-over).
    expect(headerCheckbox).toHaveAttribute('data-state', 'indeterminate');
    expect(headerCheckbox.className).toMatch(/data-\[state=indeterminate\]:bg-primary/);

    await user.click(await screen.findByRole('checkbox', { name: 'Select TC-AUTH-002' }));
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the selection status region announcement-only, with no buttons inside it', async () => {
    mockRoutes({
      ...modulesRoute,
      'GET /projects/p1/test-cases': casesRoute({ '1': pagedCases([draft, draft2, approved]) }, 2),
    });
    const user = userEvent.setup();
    renderWithClient(<CasesView project={caseProject} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Select TC-AUTH-001' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('1 AI draft selected');
    // The live region must wrap only the announced text. A screen reader re-announcing this region on
    // every selection change must not also re-announce interactive controls like Clear/Approve selected.
    expect(within(status).queryAllByRole('button')).toHaveLength(0);
    // Guards against the fix regressing back to wrapping the whole bar (including the buttons) in
    // role="status" — Clear and Approve selected must still exist, just outside the region.
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve selected' })).toBeInTheDocument();
  });
});
