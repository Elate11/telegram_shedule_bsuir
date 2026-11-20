import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { NOTIFICATIONS, UI_LABELS } from '../fixtures/testData';

test.describe('F15: Notifications (Tier 1)', () => {
  test('T1-F15-01: Notifications screen loads list from /notifications and renders date, message, and severity styling', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(NOTIFICATIONS[0].date).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[1].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[2].message).first()).toBeVisible();

    // Severity badges
    await expect(page.getByText('Инфо', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Успешно', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Важное', { exact: true }).first()).toBeVisible();

    // XSS payload in NOTIFICATIONS[3] must be rendered as text, never executed
    const xssExecuted = await page.evaluate(
      () => Boolean((window as unknown as { __xss?: unknown }).__xss),
    );
    expect(xssExecuted).toBe(false);

    const getCalls = api?.getRequestsMatching('/notifications') ?? [];
    expect(getCalls.some((r) => r.method === 'GET')).toBe(true);

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F15-02: Opening Notifications auto-dispatches PATCH /notifications for unread items and clears badge', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });

    await expect
      .poll(() => {
        const patches = (api?.getRequestsMatching('/notifications') ?? []).filter(
          (r) => r.method === 'PATCH',
        );
        return patches.length;
      })
      .toBeGreaterThanOrEqual(1);

    const backBtn = page
      .getByRole('button', { name: /Назад/i })
      .or(page.getByLabel(/Назад/i))
      .or(page.locator('[aria-label*="Назад" i], [data-testid="back-button"]'))
      .first();
    await backBtn.click();

    await expect(page.getByText(/2\s*новых/)).toHaveCount(0);
  });

  test('T1-F15-03: Type filter chips filter notifications by INFO, SUCCESS, and FAILURE/WARNING', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });

    // Filter: Успешно (only SUCCESS)
    await page.getByRole('button', { name: 'Успешно' })
      .or(page.getByText('Успешно', { exact: true }))
      .first()
      .click();
    await expect(page.getByText(NOTIFICATIONS[1].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[0].message)).toHaveCount(0);
    await expect(page.getByText(NOTIFICATIONS[2].message)).toHaveCount(0);

    // Filter: Важное (FAILURE / WARNING)
    await page.getByRole('button', { name: 'Важное' })
      .or(page.getByText('Важное', { exact: true }))
      .first()
      .click();
    await expect(page.getByText(NOTIFICATIONS[2].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[1].message)).toHaveCount(0);

    // Filter: Инфо
    await page.getByRole('button', { name: 'Инфо' })
      .or(page.getByText('Инфо', { exact: true }))
      .first()
      .click();
    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[2].message)).toHaveCount(0);

    // Filter: Все
    await page.getByRole('button', { name: 'Все' })
      .or(page.getByText('Все', { exact: true }))
      .first()
      .click();
    await expect(page.getByText(NOTIFICATIONS[1].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[2].message).first()).toBeVisible();
  });

  test('T1-F15-04: Search input filters notifications by message text and date', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });

    const searchInput = page.getByPlaceholder('Поиск').first();
    await searchInput.fill('Математический');
    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[1].message)).toHaveCount(0);

    await searchInput.fill('17.11.2026');
    await expect(page.getByText(NOTIFICATIONS[1].message).first()).toBeVisible();
    await expect(page.getByText(NOTIFICATIONS[0].message)).toHaveCount(0);
  });

  test('T1-F15-05: Offline fallback renders cached/mock notifications gracefully when network fails', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();
    const { api } = await bootApp(page, { mode: 'authenticated' });

    // Load once to populate cache
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });

    // Inject network failure on /notifications and re-open
    api?.setFaults({ abortPatterns: ['/notifications'] });
    const refreshBtn = page
      .getByRole('button', { name: /Обновить/i })
      .or(page.locator('[aria-label*="Обновить" i]'))
      .first();
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
    } else {
      await page.reload();
      await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    }

    await expect(page.getByText(NOTIFICATIONS[0].message).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
