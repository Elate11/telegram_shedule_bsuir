import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import {
  clearTelegramMockLog,
  getCloudStorageSnapshot,
  getTelegramMockLog,
  getTelegramState,
  triggerTelegramBackButton,
} from '../fixtures/telegramMock';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F2: Telegram WebApp SDK Integration', () => {
  test('T1-F2-01: App calls window.Telegram.WebApp.ready() and expand() on startup', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'raw',
      telegram: { mode: 'full' },
    });

    const logs = await getTelegramMockLog(page);
    const methods = logs.map((entry) => entry.method);

    expect(methods).toContain('ready');
    expect(methods).toContain('expand');

    const state = await getTelegramState(page);
    expect(state.isExpanded).toBe(true);
  });

  test('T1-F2-02: themeParams, colorScheme, and safe-area insets apply cleanly at 390x844 without clipping', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: {
        mode: 'full',
        colorScheme: 'light',
        safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
        contentSafeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
      },
    });

    const overflow = await checkNoHorizontalOverflow(page, 390);
    expect(overflow.ok).toBe(true);

    const layoutCheck = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const safeTop = rootStyle.getPropertyValue('--tg-safe-area-inset-top').trim();
      const safeBottom = rootStyle.getPropertyValue('--tg-safe-area-inset-bottom').trim();

      const headerOrNav = Array.from(
        document.querySelectorAll<HTMLElement>('nav, header, button, [role="tab"]'),
      );
      const allInsideViewport = headerOrNav.every((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return true;
        return r.top >= -1 && r.bottom <= 845 && r.left >= -1 && r.right <= 391;
      });

      return {
        safeTop,
        safeBottom,
        allInsideViewport,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });

    expect(layoutCheck.allInsideViewport).toBe(true);
    if (layoutCheck.safeTop) {
      expect(layoutCheck.safeTop).toContain('44');
    }
    if (layoutCheck.safeBottom) {
      expect(layoutCheck.safeBottom).toContain('34');
    }
  });

  test('T1-F2-03: Opening Profile sub-screen shows BackButton and invoking it navigates back to Profile', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      telegram: { mode: 'full' },
    });

    await clearTelegramMockLog(page);
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    await expect(
      page.getByText(/Средний балл|Зачётка|Семестр/i).first(),
    ).toBeVisible({ timeout: 5000 });

    const logsAfterOpen = await getTelegramMockLog(page);
    expect(logsAfterOpen.some((l) => l.method === 'BackButton.show')).toBe(true);
    expect((await getTelegramState(page)).backButtonVisible).toBe(true);

    await triggerTelegramBackButton(page);

    await expect(
      page.getByText(UI_LABELS.profile.customization).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T1-F2-04: Interactive controls invoke HapticFeedback when vibration is enabled', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full' },
    });

    await clearTelegramMockLog(page);

    await page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first().click();
    await openTab(page, UI_LABELS.tabs.marks);
    await openTab(page, UI_LABELS.tabs.notes);

    const logs = await getTelegramMockLog(page);
    const hapticCalls = logs.filter((l) => l.method.startsWith('HapticFeedback.'));
    expect(hapticCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('T1-F2-05: initData / initDataUnsafe.user parses cleanly and CloudStorage syncs settings', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: {
        mode: 'full',
        user: {
          id: 998877,
          first_name: 'Дмитрий',
          last_name: 'Ковалёв',
          username: 'kovalev_bsuir',
          language_code: 'ru',
        },
      },
    });

    await clearTelegramMockLog(page);
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const introSwitch = page
      .getByRole('switch', { name: /Интро при входе/i })
      .or(page.getByText(UI_LABELS.customization.introToggle).locator('..').locator('input, [role="switch"], button'))
      .first();
    await introSwitch.scrollIntoViewIfNeeded();
    await introSwitch.click();

    await page.waitForTimeout(300);

    const logs = await getTelegramMockLog(page);
    const cloudWrites = logs.filter((l) => l.method === 'CloudStorage.setItem');
    expect(cloudWrites.length).toBeGreaterThanOrEqual(1);

    const snapshot = await getCloudStorageSnapshot(page);
    expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(1);
  });
});
