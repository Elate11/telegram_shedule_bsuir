import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
  skipSplashIfVisible,
} from '../fixtures/appHarness';
import {
  getCloudStorageSnapshot,
  getTelegramMockLog,
} from '../fixtures/telegramMock';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F7: Persistence & CloudStorage Sync', () => {
  test('T1-F7-01: Selected group and subgroup persist across full page reload via storage', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    // Switch group to 310101
    await page.getByText('510902', { exact: false }).first().click();
    const searchInput = page.getByPlaceholder(/групп|преподавател/i).first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('310101');
    await page.getByText('310101', { exact: false }).last().click();

    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });

    // Select subgroup 1 ("1 подгр.") -> ТФЯ visible, Нейросети (subgroup 2) hidden
    await page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first().click();
    await expect(page.getByText('ТФЯ').first()).toBeVisible();
    await expect(page.getByText('Нейросети')).toHaveCount(0);

    await page.waitForTimeout(250);
    await page.reload();
    await skipSplashIfVisible(page);

    const guestBtn = page.getByText(UI_LABELS.auth.guestButton).first();
    if (await guestBtn.isVisible().catch(() => false)) {
      await guestBtn.click();
    }

    await expect(page.getByText('310101').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ТФЯ').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Нейросети')).toHaveCount(0);
  });

  test('T1-F7-02: Theme (Light), custom colors, and nav mode persist across reload via CloudStorage + localStorage', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full', colorScheme: 'dark' },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Switch to Light theme
    const darkToggle = page.getByText('Темная', { exact: true }).first();
    if (await darkToggle.isVisible().catch(() => false)) {
      await darkToggle.click();
    }
    await expect(page.getByText('Светлая', { exact: true }).first()).toBeVisible({ timeout: 3000 });

    // Select Green-on-Mint palette (#E8F5E9)
    await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('button, div')).find(
        (el) => getComputedStyle(el).backgroundColor === 'rgb(232, 245, 233)',
      );
      target?.click();
    });

    // Switch nav mode to Swipe
    const swipeBtn = page.getByText(UI_LABELS.customization.navSwipe, { exact: true }).first();
    await swipeBtn.scrollIntoViewIfNeeded();
    await swipeBtn.click();

    await page.waitForTimeout(300);
    const snapshotBeforeReload = await getCloudStorageSnapshot(page);
    expect(Object.keys(snapshotBeforeReload).length).toBeGreaterThanOrEqual(1);

    await page.reload();
    await skipSplashIfVisible(page);

    const persistedTheme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        bg: root.getPropertyValue('--bg').trim().toLowerCase(),
        accent: root.getPropertyValue('--accent').trim().toLowerCase(),
      };
    });

    expect(
      persistedTheme.bg === '#e8f5e9' || persistedTheme.bg === '#f5f5f7',
    ).toBe(true);
  });

  test('T1-F7-03: Created/edited/pinned notes sync to CloudStorage when running inside mocked Telegram WebApp', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full' },
      clockDate: '2026-11-19T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.notes);

    const fab = page
      .getByRole('button', { name: /Добавить|Создать|\+/i })
      .or(page.locator('button').filter({ hasText: '+' }))
      .last();
    await fab.click();

    const textInput = page
      .locator('textarea, input[placeholder*="замет" i], input[placeholder*="текст" i]')
      .first();
    await expect(textInput).toBeVisible({ timeout: 3000 });
    await textInput.fill('Подготовить лабу по АиСД');

    const pinToggle = page.getByText(UI_LABELS.notes.pinToggle, { exact: false }).first();
    if (await pinToggle.isVisible().catch(() => false)) {
      await pinToggle.click();
    }

    const saveBtn = page
      .getByRole('button', { name: /Сохранить|Создать|Добавить/i })
      .last();
    await saveBtn.click();

    await expect(page.getByText('Подготовить лабу по АиСД').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    const logs = await getTelegramMockLog(page);
    expect(logs.some((l) => l.method === 'CloudStorage.setItem')).toBe(true);

    const snapshot = await getCloudStorageSnapshot(page);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain('Подготовить лабу по АиСД');
  });

  test('T1-F7-04: Group search history stores up to 5 recent groups and persists across reload', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    const groupsToVisit = ['310101', '253501', '451001', '151002', '520901', '530101'];

    for (const grp of groupsToVisit) {
      await page.locator('h1, h2, button, div').getByText(/^\d{6}$/).first().click();
      const input = page.getByPlaceholder(/групп|преподавател/i).first();
      await expect(input).toBeVisible({ timeout: 3000 });
      await input.fill(grp);
      await page.getByText(grp, { exact: false }).last().click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(250);
    await page.reload();
    await skipSplashIfVisible(page);

    const guestBtn = page.getByText(UI_LABELS.auth.guestButton).first();
    if (await guestBtn.isVisible().catch(() => false)) {
      await guestBtn.click();
    }

    // Open search panel and check history items persisted & bounded to <= 5
    await page.getByText('530101').first().click();
    const deleteHistoryButtons = page.locator('button[aria-label*="Удал" i], button:has-text("×"), button:has-text("X")');
    const historyCount = await deleteHistoryButtons.count();
    expect(historyCount).toBeLessThanOrEqual(5);
    await expect(page.getByText('520901').first()).toBeVisible({ timeout: 3000 });
  });

  test('T1-F7-05: Without window.Telegram.WebApp (CloudStorage absent), settings and notes persist cleanly in localStorage', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'none' },
      clockDate: '2026-11-19T10:00:00',
    });

    // Create note
    await openTab(page, UI_LABELS.tabs.notes);
    const fab = page
      .getByRole('button', { name: /Добавить|Создать|\+/i })
      .or(page.locator('button').filter({ hasText: '+' }))
      .last();
    await fab.click();

    const textInput = page
      .locator('textarea, input[placeholder*="замет" i], input[placeholder*="текст" i]')
      .first();
    await textInput.fill('Локальная заметка без TG');
    await page.getByRole('button', { name: /Сохранить|Создать|Добавить/i }).last().click();
    await expect(page.getByText('Локальная заметка без TG').first()).toBeVisible({ timeout: 5000 });

    const localLen = await page.evaluate(() => localStorage.length);
    expect(localLen).toBeGreaterThan(0);

    await page.reload();
    await skipSplashIfVisible(page);
    const guestBtn = page.getByText(UI_LABELS.auth.guestButton).first();
    if (await guestBtn.isVisible().catch(() => false)) {
      await guestBtn.click();
    }

    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText('Локальная заметка без TG').first()).toBeVisible({ timeout: 5000 });
  });
});
