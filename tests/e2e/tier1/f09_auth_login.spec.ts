import {
  test,
  expect,
  bootApp,
  openTab,
} from '../fixtures/appHarness';
import { AUTH_CREDENTIALS, UI_LABELS } from '../fixtures/testData';

test.describe('F9: Auth Screen (LoginScreen & Guest Mode)', () => {
  test('T1-F9-01: Login screen renders gradebook input, password input, "Войти", and "Продолжить без входа"', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'raw' });

    const gradebookInput = page
      .getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder)
      .or(page.getByLabel(UI_LABELS.auth.gradebookPlaceholder))
      .first();
    const passwordInput = page
      .getByPlaceholder(UI_LABELS.auth.passwordPlaceholder)
      .or(page.getByLabel(UI_LABELS.auth.passwordPlaceholder))
      .first();
    const loginBtn = page
      .getByRole('button', { name: UI_LABELS.auth.loginButton, exact: true })
      .first();
    const guestBtn = page
      .getByRole('button', { name: UI_LABELS.auth.guestButton })
      .or(page.getByText(UI_LABELS.auth.guestButton))
      .first();

    await expect(gradebookInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible();
    await expect(loginBtn).toBeVisible();
    await expect(guestBtn).toBeVisible();
  });

  test('T1-F9-02: Password visibility toggle switches input type between password and text', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'raw' });

    const passwordInput = page
      .getByPlaceholder(UI_LABELS.auth.passwordPlaceholder)
      .or(page.getByLabel(UI_LABELS.auth.passwordPlaceholder))
      .first();
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await passwordInput.fill(AUTH_CREDENTIALS.validPass);

    const toggleBtn = passwordInput
      .locator('..')
      .locator('button, [role="button"]')
      .first();
    await expect(toggleBtn).toBeVisible({ timeout: 3000 });
    await toggleBtn.click();

    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('T1-F9-03: Valid credentials call POST /auth/login, fetch profile, and transition to main Schedule screen', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'raw' });

    const gradebookInput = page
      .getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder)
      .or(page.getByLabel(UI_LABELS.auth.gradebookPlaceholder))
      .first();
    const passwordInput = page
      .getByPlaceholder(UI_LABELS.auth.passwordPlaceholder)
      .or(page.getByLabel(UI_LABELS.auth.passwordPlaceholder))
      .first();

    await gradebookInput.fill(AUTH_CREDENTIALS.validUser);
    await passwordInput.fill(AUTH_CREDENTIALS.validPass);
    await page
      .getByRole('button', { name: UI_LABELS.auth.loginButton, exact: true })
      .first()
      .click();

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible({ timeout: 5000 });

    const loginReqs = api!.getRequestsMatching('/auth/login');
    expect(loginReqs.length).toBe(1);
    expect(loginReqs[0].method).toBe('POST');

    const profileReqs = api!.getRequestsMatching('/profiles/personal-cv');
    expect(profileReqs.length).toBeGreaterThanOrEqual(1);
  });

  test('T1-F9-04: Clicking "Продолжить без входа" enters Guest mode with default schedule', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'raw',
      clockDate: '2026-11-19T08:00:00',
    });

    const guestBtn = page
      .getByRole('button', { name: UI_LABELS.auth.guestButton })
      .or(page.getByText(UI_LABELS.auth.guestButton))
      .first();
    await guestBtn.click();

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/510902|310101/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/ОАиП|ИИиМО/).first()).toBeVisible({ timeout: 5000 });

    expect(api!.getRequestsMatching('/auth/login').length).toBe(0);
  });

  test('T1-F9-05: Logout from Profile clears session auth state and returns to Login screen', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });

    await openTab(page, UI_LABELS.tabs.profile);

    const logoutBtn = page
      .getByRole('button', { name: UI_LABELS.profile.logout })
      .or(page.getByText(UI_LABELS.profile.logout, { exact: true }))
      .first();
    await logoutBtn.scrollIntoViewIfNeeded();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    // Confirm modal if present
    const confirmLogout = page
      .getByRole('dialog')
      .getByRole('button', { name: /Выйти|Да|Подтвердить/i })
      .first();
    if (await confirmLogout.isVisible().catch(() => false)) {
      await confirmLogout.click();
    }

    await expect(
      page.getByRole('button', { name: UI_LABELS.auth.loginButton, exact: true }).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(UI_LABELS.auth.guestButton).first(),
    ).toBeVisible();
  });
});
