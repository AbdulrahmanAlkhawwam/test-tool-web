import { expect, test } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'admin@ejad.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'ChangeMe123!';

test('project → test case → run → failure shows in case history', async ({ page }) => {
  const key = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;

  // Log in
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  // Create project
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name', { exact: true }).fill(`E2E ${key}`);
  await page.getByLabel('Key', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${key}/cases`));

  // Add a module
  await page.getByRole('button', { name: 'Add module' }).click();
  await page.getByLabel('New module').fill('Authentication');
  await expect(page.getByLabel('Code')).toHaveValue('AUTH');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('0 cases')).toBeVisible();
  await page.keyboard.press('Escape');

  // Create a test case
  await page.getByRole('button', { name: 'New test case' }).click();
  await page.getByLabel('Test case name').fill('Login with wrong password');
  await page.getByLabel('Test steps').fill('1. Enter email\n2. Enter wrong password\n3. Tap Login');
  await page.getByLabel('Expected result').fill('Error message displayed');
  await page.getByRole('button', { name: 'Create test case' }).click();
  await expect(page.getByRole('link', { name: 'Login with wrong password' })).toBeVisible();
  await expect(page.getByText('TC-AUTH-001')).toBeVisible();

  // Start a run
  await page.getByRole('link', { name: 'Runs' }).click();
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByLabel('Name', { exact: true }).fill('E2E run');
  await page.getByRole('button', { name: 'Start run' }).click();
  await expect(page.getByRole('heading', { name: 'E2E run' })).toBeVisible();

  // Execute: mark Failed and record the actual result
  await page.getByRole('radio', { name: 'Failed' }).check({ force: true });
  await expect(page.getByText('Saved ✓')).toBeVisible();
  await page.getByRole('button', { name: /TC-AUTH-001/ }).click();
  const actual = page.getByLabel('Actual result');
  await actual.fill('No error shown, stays on login');
  await actual.blur();
  await expect(page.getByText('Saved ✓')).toBeVisible();
  await expect(page.getByText('1 / 1')).toBeVisible();

  // Complete the run
  await page.getByRole('button', { name: 'Complete run' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Complete run' }).click();
  await expect(page.getByText('This run is completed. Results are read-only.')).toBeVisible();

  // The case history shows the failure
  await page.goto(`/projects/${key}/cases`);
  await page.getByRole('link', { name: 'Login with wrong password' }).click();
  await expect(page.getByRole('heading', { name: 'Result history' })).toBeVisible();
  const history = page.getByRole('table');
  await expect(history.getByText('E2E run')).toBeVisible();
  await expect(history.getByText('Failed')).toBeVisible();
  await expect(history.getByText('No error shown, stays on login')).toBeVisible();
});
