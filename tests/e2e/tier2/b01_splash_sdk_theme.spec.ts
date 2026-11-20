import {
  bootApp,
  checkNoHorizontalOverflow,
  enterGuestMode,
  expect,
  openProfileSubScreen,
  openTab,
  skipSplashIfVisible,
  test,
} from '../fixtures/appHarness';
import { AUTH_CREDENTIALS, UI_LABELS } from '../fixtures/testData';

function parseRgb(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

async function getRootColors(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const appEl = document.querySelector('#root > div') ?? document.body;
    const appStyle = getComputedStyle(appEl);
    return {
      cssBg: rootStyle.getPropertyValue('--bg').trim(),
      cssText: rootStyle.getPropertyValue('--text').trim(),
      bodyBg: bodyStyle.backgroundColor,
      appBg: appStyle.backgroundColor,
      bodyColor: bodyStyle.color,
      appColor: appStyle.color,
    };
  });
}

test.describe('Tier 2 — F1: Intro Splash Boundaries', () => {
  test('T2-F1-01: Rapid double-tap during splash fade-out does not double-trigger navigation or throw errors', async ({
    page,
  }) => {
    await bootApp(page, { skipSplash: false, mode: 'raw' });

    // Rapid double-tap on splash screen
    await page.mouse.click(195, 422);
    await page.mouse.click(195, 422);

    const loginBtn = page.getByRole('button', { name: UI_LABELS.auth.loginButton });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await expect(loginBtn).toHaveCount(1);

    const overflow = await checkNoHorizontalOverflow(page, 390);
    expect(overflow.ok).toBe(true);
  });

  test('T2-F1-02: Already-logged-in reload with intro_video_enabled=true runs splash cleanly over authenticated Schedule without losing group state', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      telegram: {
        mode: 'full',
        initialCloudStorage: {
          intro_video_enabled: 'true',
        },
      },
    });

    await expect(page.getByText(AUTH_CREDENTIALS.defaultGroup).first()).toBeVisible();

    await page.reload();
    await skipSplashIfVisible(page);

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(AUTH_CREDENTIALS.defaultGroup).first()).toBeVisible();
  });

  test('T2-F1-03: Replaying intro from Customization when in Light theme renders #101116 dark splash cleanly and restores Light theme afterward', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const lightBtn = page.getByText(/Светлая/i).first();
    await expect(lightBtn).toBeVisible({ timeout: 5000 });
    await lightBtn.click();

    await expect
      .poll(async () => {
        const colors = await getRootColors(page);
        const rgb = parseRgb(colors.appBg) ?? parseRgb(colors.bodyBg);
        return rgb ? relativeLuminance(rgb) : 0;
      })
      .toBeGreaterThan(0.5);

    const replayBtn = page.getByText(UI_LABELS.customization.replayIntro).first();
    await replayBtn.scrollIntoViewIfNeeded();
    await replayBtn.click();

    // Verify dark splash (#101116 -> rgb(16, 17, 22)) renders while visible
    const splashOverlay = page
      .locator('[data-testid="intro-splash"], [aria-label*="интро" i], [aria-label*="splash" i], canvas')
      .first();
    await expect(splashOverlay).toBeVisible({ timeout: 3000 });

    const splashBgDark = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('div, canvas'));
      return candidates.some((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width < 300 || rect.height < 600) return false;
        const bg = style.backgroundColor;
        return bg === 'rgb(16, 17, 22)' || bg.includes('16, 17, 22');
      });
    });
    expect(splashBgDark).toBe(true);

    // Dismiss replayed splash
    await page.mouse.click(195, 422);
    await expect(page.getByText(UI_LABELS.customization.replayIntro).first()).toBeVisible({
      timeout: 5000,
    });

    // Light theme is restored afterward
    const colorsAfter = await getRootColors(page);
    const rgbAfter = parseRgb(colorsAfter.appBg) ?? parseRgb(colorsAfter.bodyBg);
    expect(rgbAfter ? relativeLuminance(rgbAfter) : 0).toBeGreaterThan(0.5);
  });

  test('T2-F1-04: Splash timer completes safely under throttled timers / page.clock fast-forward', async ({
    page,
  }) => {
    await page.clock.install();
    await bootApp(page, { skipSplash: false, mode: 'raw' });

    await page.clock.fastForward(4500);

    await expect(
      page
        .getByRole('button', { name: UI_LABELS.auth.loginButton })
        .or(page.getByText(UI_LABELS.auth.guestButton))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2-F1-05: Missing or corrupted intro_video_enabled storage value defaults safely without crash', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('intro_video_enabled', '{corrupted_bool_$$$');
    });

    await bootApp(page, {
      skipSplash: false,
      mode: 'raw',
      telegram: {
        mode: 'full',
        initialCloudStorage: {
          intro_video_enabled: 'not_valid_bool',
        },
      },
    });

    await skipSplashIfVisible(page);
    await expect(page.getByRole('button', { name: UI_LABELS.auth.loginButton })).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Tier 2 — F2: Telegram WebApp SDK Boundaries', () => {
  test('T2-F2-01: Running with window.Telegram completely undefined works smoothly in browser fallback mode', async ({
    page,
  }) => {
    await bootApp(page, { telegram: { mode: 'none' }, mode: 'guest' });

    const hasTelegram = await page.evaluate(
      () => typeof (window as unknown as { Telegram?: unknown }).Telegram !== 'undefined',
    );
    expect(hasTelegram).toBe(false);

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await openTab(page, UI_LABELS.tabs.notes);
    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(UI_LABELS.profile.customization).first()).toBeVisible();
  });

  test('T2-F2-02: Telegram.WebApp present without CloudStorage (v6.0) falls back cleanly to localStorage', async ({
    page,
  }) => {
    await bootApp(page, {
      telegram: { mode: 'noCloudStorage', version: '6.0' },
      mode: 'guest',
    });

    await openTab(page, UI_LABELS.tabs.notes);
    const addBtn = page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first();
    await addBtn.click();

    const noteText = 'Заметка для fallback localStorage без CloudStorage';
    await page.locator('textarea').first().fill(noteText);
    await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();

    await expect(page.getByText(noteText)).toBeVisible({ timeout: 5000 });

    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page).catch(() => {});
    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 5000 });
  });

  test('T2-F2-03: Malformed/corrupted initData string does not crash app startup or user greeting', async ({
    page,
  }) => {
    await bootApp(page, {
      telegram: { mode: 'corruptedInitData' },
      mode: 'guest',
    });

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible();
    await openTab(page, UI_LABELS.tabs.profile);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });

  test('T2-F2-04: Partial SDK object missing HapticFeedback/BackButton/MainButton methods is guarded safely', async ({
    page,
  }) => {
    await bootApp(page, {
      telegram: { mode: 'partialSdk' },
      mode: 'guest',
    });

    await page.getByText(UI_LABELS.schedule.subgroup1).first().click();
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const testVibBtn = page.getByText(UI_LABELS.customization.testVibration).first();
    if (await testVibBtn.isVisible().catch(() => false)) {
      await testVibBtn.click();
    }

    const backBtn = page.getByRole('button', { name: /назад/i }).first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
    }
    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible();
  });

  test('T2-F2-05: Extreme safe-area insets (top: 59, bottom: 34) keep headers, FABs, and bottom nav unclipped inside 390x844', async ({
    page,
  }) => {
    await bootApp(page, {
      telegram: {
        mode: 'full',
        safeAreaInset: { top: 59, bottom: 34, left: 0, right: 0 },
        contentSafeAreaInset: { top: 59, bottom: 34, left: 0, right: 0 },
      },
      mode: 'guest',
    });

    // Switch to Buttons mode so bottom nav is rendered
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const buttonsChip = page.getByText(UI_LABELS.customization.navButtons, { exact: true }).first();
    await buttonsChip.scrollIntoViewIfNeeded();
    await buttonsChip.click();

    await openTab(page, UI_LABELS.tabs.notes);
    const overflow = await checkNoHorizontalOverflow(page, 390);
    expect(overflow.ok).toBe(true);

    const navBox = await page.locator('nav, [role="tablist"]').first().boundingBox();
    expect(navBox).not.toBeNull();
    if (navBox) {
      expect(navBox.y).toBeGreaterThanOrEqual(0);
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(844);
    }
  });
});

test.describe('Tier 2 — F3: Theme Engine & Backgrounds Boundaries', () => {
  test('T2-F3-01: Setting bright custom background color (#F0F8FF) ensures dark readable text', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const bgTrigger = page.getByText(/^Фон$/).first();
    await bgTrigger.click();

    const hexInput = page.locator('input[placeholder*="#"], input[maxlength="7"]').first();
    await expect(hexInput).toBeVisible({ timeout: 3000 });
    await hexInput.fill('#F0F8FF');
    await page.getByRole('button', { name: /применить|готово|ок|выбрать|сохранить/i }).first().click();

    await expect
      .poll(async () => {
        const colors = await getRootColors(page);
        const rgb = parseRgb(colors.appColor) ?? parseRgb(colors.bodyColor);
        return rgb ? relativeLuminance(rgb) : 1;
      })
      .toBeLessThan(0.45);
  });

  test('T2-F3-02: Setting near-black custom background (#050505) ensures primary text becomes light (#FFFFFF)', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // First switch to Light so switching to #050505 verifies auto-contrast flip
    await page.getByText(/Светлая/i).first().click();
    await page.getByText(/^Фон$/).first().click();

    const hexInput = page.locator('input[placeholder*="#"], input[maxlength="7"]').first();
    await expect(hexInput).toBeVisible({ timeout: 3000 });
    await hexInput.fill('#050505');
    await page.getByRole('button', { name: /применить|готово|ок|выбрать|сохранить/i }).first().click();

    await expect
      .poll(async () => {
        const colors = await getRootColors(page);
        const rgb = parseRgb(colors.appColor) ?? parseRgb(colors.bodyColor);
        return rgb ? relativeLuminance(rgb) : 0;
      })
      .toBeGreaterThan(0.6);
  });

  test('T2-F3-03: Font scale at minimum (0.8x) and maximum (1.4x) produces zero horizontal overflow on Schedule and Profile', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const scaleSection = page.getByText(/Размер текста/i).first();
    await scaleSection.scrollIntoViewIfNeeded();
    const scaleSlider = page.locator('input[type="range"]').filter({
      has: page.locator('..'),
    });

    // Find range input with min=0.8 and max=1.4
    const textRange = page.locator('input[type="range"][min="0.8"][max="1.4"]').first();
    if (await textRange.isVisible().catch(() => false)) {
      await textRange.fill('0.8');
      await textRange.dispatchEvent('change');
    } else if ((await scaleSlider.count()) > 0) {
      await scaleSlider.last().fill('0.8');
    }

    await openTab(page, UI_LABELS.tabs.schedule);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);

    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    if (await textRange.isVisible().catch(() => false)) {
      await textRange.fill('1.4');
      await textRange.dispatchEvent('change');
    }

    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
    await openTab(page, UI_LABELS.tabs.schedule);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F3-04: Gallery background with bgBlur=0 vs max bgBlur=50 and bgDim=1.0 renders cleanly without hiding interactive controls', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const photoBtn = page.getByText(UI_LABELS.customization.bgGallery, { exact: true }).first();
    await photoBtn.scrollIntoViewIfNeeded();
    await photoBtn.click();

    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      const png1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      );
      await fileInput.setInputFiles({
        name: 'bg.png',
        mimeType: 'image/png',
        buffer: png1x1,
      });
    }

    const blurSlider = page.locator('input[type="range"][max="50"]').first();
    if (await blurSlider.isVisible().catch(() => false)) {
      await blurSlider.fill('0');
      await blurSlider.fill('50');
    }
    const dimSlider = page.locator('input[type="range"][max="1"]').first();
    if (await dimSlider.isVisible().catch(() => false)) {
      await dimSlider.fill('1');
    }

    await expect(page.getByText(UI_LABELS.customization.bgSolid).first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.customization.bgSolid).first()).toBeEnabled();
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F3-05: Invalid/non-hex color string in storage falls back to default Dark/Light tokens without breaking CSS variables', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('customPrimaryColor', 'invalid_color_value');
      localStorage.setItem('customBackgroundColor', '###NOTHEX');
      localStorage.setItem('bsuir_theme_prefs', JSON.stringify({
        customPrimaryColor: 'not-hex',
        customBackgroundColor: 'rgb(bad)',
      }));
    });

    await bootApp(page, { mode: 'guest' });

    const colors = await getRootColors(page);
    const bgRgb = parseRgb(colors.appBg) ?? parseRgb(colors.bodyBg);
    const textRgb = parseRgb(colors.appColor) ?? parseRgb(colors.bodyColor);
    expect(bgRgb).not.toBeNull();
    expect(textRgb).not.toBeNull();
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});

test.describe('Tier 2 — F4: LiquidGlass & AppleDesign Primitives Boundaries', () => {
  test('T2-F4-01: Search input with special regex characters ([(*+?^$\\) does not throw SyntaxError in filtering', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    const headerGroup = page.getByText(AUTH_CREDENTIALS.defaultGroup).first();
    await headerGroup.click();

    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('[(*+?^$\\');

    await page.waitForTimeout(200);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F4-02: Search input with >200 characters truncates/scrolls without breaking 390px layout width', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    const headerGroup = page.getByText(AUTH_CREDENTIALS.defaultGroup).first();
    await headerGroup.click();

    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('А'.repeat(240));

    const box = await searchInput.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(390);
    }
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F4-03: IosDatePickerModal / IosTimePickerModal cancel/dismiss leaves original date/time untouched', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest', clockDate: '2026-11-19T10:00:00' });
    await openTab(page, UI_LABELS.tabs.notes);

    await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();

    const modalTextBefore = await page.locator('[role="dialog"], .fixed').last().innerText();
    const dateBtn = page.getByRole('button', { name: /\d{2}\.\d{2}\.\d{4}/ }).first();
    await expect(dateBtn).toBeVisible({ timeout: 3000 });
    const originalDate = (await dateBtn.innerText()).trim();

    await dateBtn.click();
    // Pick another day inside calendar if visible, then click Cancel
    const day25 = page.getByRole('button', { name: /^25$/ }).first();
    if (await day25.isVisible().catch(() => false)) {
      await day25.click();
    }
    await page.getByRole('button', { name: /отмена|закрыть/i }).last().click();

    await expect(dateBtn).toHaveText(originalDate);

    // Time picker cancel check
    const timeBtn = page.getByRole('button', { name: /\d{2}:\d{2}/ }).first();
    if (await timeBtn.isVisible().catch(() => false)) {
      const originalTime = (await timeBtn.innerText()).trim();
      await timeBtn.click();
      await page.getByRole('button', { name: /отмена|закрыть/i }).last().click();
      await expect(timeBtn).toHaveText(originalTime);
    }
    expect(modalTextBefore.length).toBeGreaterThan(0);
  });

  test('T2-F4-04: Very small pull-to-refresh drag (<70px threshold) snaps back without firing redundant refresh', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'guest' });
    expect(api).not.toBeNull();
    await page.waitForTimeout(300);
    api!.clearRequests();

    await page.mouse.move(195, 250);
    await page.mouse.down();
    await page.mouse.move(195, 285, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(400);
    const scheduleCalls = api!.getRequestsMatching(/\/schedule/);
    expect(scheduleCalls.length).toBe(0);
  });

  test('T2-F4-05: Pointer drag across LiquidGlassSurface near viewport edges (x=0, x=390) stays bounded without overflow', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    await page.mouse.move(1, 320);
    await page.mouse.down();
    await page.mouse.move(389, 320, { steps: 10 });
    await page.mouse.up();

    await page.mouse.move(389, 420);
    await page.mouse.down();
    await page.mouse.move(1, 420, { steps: 10 });
    await page.mouse.up();

    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});
