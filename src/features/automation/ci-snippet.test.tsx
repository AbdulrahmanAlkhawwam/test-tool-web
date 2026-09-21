import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRoutes } from '@/test/fetch-routes';
import { renderWithClient } from '@/test/render';
import { CiSnippet } from './ci-snippet';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('CiSnippet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the CI job and copies it', async () => {
    const yaml = 'ejad-playwright:\n  image: mcr.microsoft.com/playwright:v1.47.0-jammy\n';
    mockRoutes({ 'GET /projects/p1/automation/ci-snippet': { playwrightConfigPath: 'playwright.config.ts', yaml } });
    const user = userEvent.setup();
    renderWithClient(<CiSnippet projectId="p1" />);

    expect(await screen.findByText(/ejad-playwright:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(yaml);
  });
});
