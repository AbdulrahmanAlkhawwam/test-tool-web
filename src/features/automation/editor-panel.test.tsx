import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockRoutes } from '@/test/fetch-routes';
import { fileAt, mergeRequest } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { EditorPanel } from './editor-panel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./code-editor', () => import('@/test/code-editor-mock'));

const FILE = 'e2e/auth/login.spec.ts';
const FILE_ROUTE = 'GET /projects/p1/automation/file';
const SAVE_ROUTE = 'PUT /projects/p1/automation/file';
const saved = { branch: 'tests/amina-login-fixes', commitId: 'c2', mergeRequest };

function renderPanel(props: Partial<ComponentProps<typeof EditorPanel>> = {}) {
  const onSaved = vi.fn();
  const onDirtyChange = vi.fn();
  renderWithClient(
    <EditorPanel projectId="p1" branch="main" path={FILE} isNew={false} username="amina" onSaved={onSaved} onDirtyChange={onDirtyChange} {...props} />,
  );
  return { onSaved, user: userEvent.setup() };
}

describe('EditorPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for a work name on the first save from the default branch', async () => {
    const { callsTo } = mockRoutes({ [FILE_ROUTE]: fileAt('main', 'old', 'c1'), [SAVE_ROUTE]: saved });
    const { onSaved, user } = renderPanel();

    const editor = await screen.findByLabelText('Code editor');
    expect(editor).toHaveValue('old');
    fireEvent.change(editor, { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(await screen.findByLabelText('Work name'), 'Login fixes');
    expect(screen.getByText('tests/amina-login-fixes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save to my branch' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toEqual({
      path: FILE,
      content: 'new',
      lastCommitId: 'c1',
      branchSlug: 'login-fixes',
    });
  });

  it("saves straight to the user's work branch without asking", async () => {
    const { callsTo } = mockRoutes({ [FILE_ROUTE]: fileAt('tests/amina-login-fixes', 'old', 'c1'), [SAVE_ROUTE]: saved });
    const { onSaved, user } = renderPanel({ branch: 'tests/amina-login-fixes' });

    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(screen.queryByLabelText('Work name')).not.toBeInTheDocument();
    expect(callsTo('PUT', '/projects/p1/automation/file')[0].body).toMatchObject({ branchSlug: 'login-fixes', lastCommitId: 'c1' });
  });

  it('shows the stale-file message on 409 and reloads the latest version', async () => {
    let reads = 0;
    mockRoutes({
      [FILE_ROUTE]: () => (reads++ === 0 ? fileAt('tests/amina-login-fixes', 'old', 'c1') : fileAt('tests/amina-login-fixes', 'theirs', 'c3')),
      [SAVE_ROUTE]: () => apiError(409, 'This file changed on the branch – reload it before saving'),
    });
    const { onSaved, user } = renderPanel({ branch: 'tests/amina-login-fixes' });

    fireEvent.change(await screen.findByLabelText('Code editor'), { target: { value: 'mine' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file changed on the branch – reload it before saving');
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(screen.getByLabelText('Code editor')).toHaveValue('theirs'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens files over 1 MB read-only', async () => {
    mockRoutes({ [FILE_ROUTE]: fileAt('main', 'big', 'c1', { size: 2_000_000, readOnly: true }) });
    renderPanel();
    expect(await screen.findByLabelText('Code editor')).toHaveAttribute('readonly');
    expect(screen.getByText(/larger than 1 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('locks the editor while a save is in flight so a keystroke can never be lost on remount', async () => {
    let resolveSave!: (value: unknown) => void;
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mockRoutes({ [FILE_ROUTE]: fileAt('tests/amina-login-fixes', 'old', 'c1'), [SAVE_ROUTE]: () => pendingSave });
    const { user } = renderPanel({ branch: 'tests/amina-login-fixes' });

    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'new' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getAllByText('Saving…')).toHaveLength(2);
    expect(screen.getByLabelText('Code editor')).toHaveAttribute('readonly');

    resolveSave(saved);

    await waitFor(() => expect(screen.getByLabelText('Code editor')).not.toHaveAttribute('readonly'));
    expect(screen.getByLabelText('Code editor')).toHaveValue('new');
  });
});
