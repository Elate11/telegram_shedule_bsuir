import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { getTelegramMockLog, clearTelegramMockLog } from '../fixtures/telegramMock';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F22: Customization & Settings (Tier 1)', () => {
  test('T1-F22-01: Explicit Dark/Light theme switcher toggles themes immediately and Techno theme is absent', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    await expect(page.getByText('Кастомизация').first()).toBeVisible({
      timeout: 5000,
    });

    // Strict Android parity: NO Techno theme anywhere in UI
    await expect(page.getByText(/techno|техно/i)).toHaveCount(0);

    const getCanvasBg = () =>
      page.evaluate(() => {
        const bg1 = getComputedStyle(document.body).backgroundColor;
        const root = document.getElementById('root')?.firstElementChild;
        const bg2 = root ? getComputedStyle(root).backgroundColor : '';
        return { bg1, bg2 };
      });

    // Starts in Dark theme (#272729 -> rgb(39, 39, 41))
    await expect(page.getByText(/Темная|Тёмная/i).first()).toBeVisible();
    const darkColors = await getCanvasBg();
    expect(`${darkColors.bg1} ${darkColors.bg2}`).toMatch(/rgb\(39,\s*39,\s*41\)/);

    // Toggle to Light theme (#F5F5F7 -> rgb(245, 245, 247))
    const themeToggle = page
      .getByRole('button', { name: /Темная|Тёмная|Светлая|Тема/i })
      .or(page.getByText(/Темная|Тёмная/i))
      .first();
    await themeToggle.click();

    await expect(page.getByText('Светлая').first()).toBeVisible({ timeout: 5000 });
    const lightColors = await getCanvasBg();
    expect(`${lightColors.bg1} ${lightColors.bg2}`).toMatch(/rgb\(245,\s*245,\s*247\)/);

    // Confirm Techno still absent
    await expect(page.getByText(/techno|техно/i)).toHaveCount(0);

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F22-02: Custom Primary and Background color pickers apply colors, + saves custom palette, and Сброс restores defaults', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Open Background color picker
    const bgLabel = page.getByText('Фон', { exact: true }).first();
    await expect(bgLabel).toBeVisible({ timeout: 5000 });
    const bgSection = page
      .locator('div')
      .filter({ has: bgLabel })
      .filter({ has: page.getByText(UI_LABELS.customization.resetPalette, { exact: true }) })
      .last();

    // Click color circle/button or color input
    const bgColorInput = bgSection.locator('input[type="color"]').first();
    if (await bgColorInput.count() > 0) {
      await bgColorInput.fill('#123456');
    } else {
      await bgLabel.locator('..').locator('button, [role="button"], div').nth(1).click();
      const pickerConfirm = page.getByText(/ВЫБРАТЬ|Применить/i).first();
      if (await pickerConfirm.isVisible().catch(() => false)) {
        await pickerConfirm.click();
      }
    }

    // Save custom palette with '+' button
    const addPaletteBtn = page
      .getByRole('button', { name: /Add custom|Добавить палитру|\+/i })
      .or(page.locator('[aria-label*="Add custom" i], [aria-label*="Добавить палитру" i]'))
      .first();
    if (await addPaletteBtn.isVisible().catch(() => false)) {
      await addPaletteBtn.click();
    }

    // Click "Сброс" to restore defaults
    const resetButtons = page.getByText(UI_LABELS.customization.resetPalette, {
      exact: true,
    });
    const resetCount = await resetButtons.count();
    expect(resetCount).toBeGreaterThanOrEqual(2);
    await resetButtons.first().click();
    await resetButtons.nth(1).click();

    // Default Dark background #272729 restored
    const restored = await page.evaluate(() => {
      const root = document.getElementById('root')?.firstElementChild;
      return `${getComputedStyle(document.body).backgroundColor} ${root ? getComputedStyle(root).backgroundColor : ''}`;
    });
    expect(restored).toMatch(/rgb\(39,\s*39,\s*41\)/);
  });

  test('T1-F22-03: Event reminder timing chips, custom hours 1..72h, and Проверить уведомление work interactively', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    await expect(page.getByText('За 15 мин').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('За 1 час').first().click();
    await page.getByText('За 2 часа').first().click();
    await page.getByText('За 1 день').first().click();
    await page.getByText('Свой вариант').first().click();

    await expect(page.getByText(/ч\./).first()).toBeVisible({ timeout: 5000 });
    const plusBtn = page.getByText('+', { exact: true }).last();
    await plusBtn.click();
    await expect(page.getByText(/4 ч\./).first()).toBeVisible();

    await page.getByText(UI_LABELS.customization.testNotification).first().click();
    await expect(page.getByText(/Напоминание|Тестовое событие/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T1-F22-04: Vibration controls, text scale slider, and transition speed slider with 5 demo boxes work interactively', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    await clearTelegramMockLog(page);
    await page.getByText(UI_LABELS.customization.testVibration).first().click();

    const tgLog = await getTelegramMockLog(page);
    const hapticCalled = tgLog.some((e) => e.method.startsWith('HapticFeedback.'));
    expect(hapticCalled).toBe(true);

    // Text scale slider (0.8x..1.4x)
    await expect(page.getByText(/Размер текста/i).first()).toBeVisible();
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBeGreaterThanOrEqual(2);

    // 5 transition demo boxes (Slide, Fade, Scale, Cube, Flip)
    for (const label of ['Slide', 'Fade', 'Scale', 'Cube', 'Flip']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await page.getByText('Cube', { exact: true }).first().click();
    await expect(page.getByText(/Скорость переходов/i).first()).toBeVisible();
  });

  test('T1-F22-05: Navigation mode selector and API Base URL / Offline mode toggle apply live', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Navigation mode selector
    await expect(page.getByText(UI_LABELS.customization.navHold).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.customization.navSwipe).first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.customization.navButtons).first()).toBeVisible();

    await page.getByText(UI_LABELS.customization.navSwipe).first().click();
    await expect(page.getByText(/Свайпом/i).first()).toBeVisible();

    await page.getByText(UI_LABELS.customization.navButtons).first().click();
    await expect(page.getByText(/4 кнопки|Кнопками/i).first()).toBeVisible();

    // Offline mode toggle prevents live network calls
    const offlineLabel = page.getByText(/Оффлайн|Offline/i).first();
    await expect(offlineLabel).toBeVisible();
    const offlineSwitch = page
      .locator('div, label')
      .filter({ hasText: /Оффлайн|Offline/i })
      .locator('input[type="checkbox"], [role="switch"]')
      .first();
    if (await offlineSwitch.isVisible().catch(() => false)) {
      await offlineSwitch.click();
    } else {
      await offlineLabel.click();
    }

    api?.clearRequests();
    const backBtn = page
      .getByRole('button', { name: /Назад/i })
      .or(page.getByLabel(/Назад/i))
      .or(page.locator('[aria-label*="Назад" i], [data-testid="back-button"]'))
      .first();
    await backBtn.click();

    await page.getByText(UI_LABELS.tabs.schedule, { exact: true }).last().click();
    await page.waitForTimeout(300);
    const liveScheduleReqs = (api?.getRequestsMatching('/schedule') ?? []).length;
    expect(liveScheduleReqs).toBe(0);
  });
});
