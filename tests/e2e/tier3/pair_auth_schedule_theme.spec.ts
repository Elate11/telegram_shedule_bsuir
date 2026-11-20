import type { Page } from '@playwright/test';
import {
  test,
  expect,
  bootApp,
  loginAsStudent,
  openTab,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import {
  ANDROID_THEMES,
  AUTH_CREDENTIALS,
  GROUP_SCHEDULES,
  RECOMMENDED_PALETTES,
  UI_LABELS,
  createSessionActiveSchedule,
} from '../fixtures/testData';
import { getTelegramMockLog } from '../fixtures/telegramMock';

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseCssRgb(cssColor: string): [number, number, number] | null {
  const match = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

async function getSurfaceBackgroundRgb(page: Page): Promise<[number, number, number]> {
  const raw = await page.evaluate(() => {
    const candidates = [
      document.body,
      document.documentElement,
      document.querySelector('#root') as HTMLElement | null,
      document.querySelector('main') as HTMLElement | null,
    ];
    for (const el of candidates) {
      if (!el) continue;
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        return bg;
      }
    }
    const rootVar = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    return rootVar || 'rgb(0, 0, 0)';
  });
  if (raw.startsWith('#')) return hexToRgbTuple(raw);
  return parseCssRgb(raw) ?? [0, 0, 0];
}

async function isCurrentlyDark(page: Page): Promise<boolean> {
  const rgb = await getSurfaceBackgroundRgb(page);
  return relativeLuminance(rgb) < 0.45;
}

async function switchThemeMode(page: Page, target: 'dark' | 'light'): Promise<void> {
  const wantDark = target === 'dark';
  if ((await isCurrentlyDark(page)) === wantDark) return;

  const targetBtn = wantDark
    ? page.getByRole('button', { name: /т[её]мн/i }).or(page.getByText(/^(Т[её]мная|Темная)$/i))
    : page.getByRole('button', { name: /светл/i }).or(page.getByText(/^Светлая$/i));

  if (await targetBtn.first().isVisible().catch(() => false)) {
    await targetBtn.first().click();
  } else {
    const themeToggle = page
      .getByRole('button', { name: /тема/i })
      .or(page.getByText(/^Тема$/i))
      .first();
    await themeToggle.click();
  }
  await page.waitForTimeout(150);
}

async function applyPaletteSwatch(page: Page, primaryHex: string, bgHex: string): Promise<void> {
  const targetBg = hexToRgbTuple(bgHex);
  const targetPrimary = hexToRgbTuple(primaryHex);

  const coords = await page.evaluate(
    ({ bg, primary }) => {
      const rgbStr = (t: number[]) => `rgb(${t[0]}, ${t[1]}, ${t[2]})`;
      const bgTarget = rgbStr(bg);
      const primaryTarget = rgbStr(primary);

      const all = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], div'));
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 28 || rect.width > 120 || rect.height < 28 || rect.height > 120) continue;
        const styleBg = getComputedStyle(el).backgroundColor.replace(/\s+/g, ' ');
        if (styleBg === bgTarget) {
          const innerMatch = Array.from(el.querySelectorAll<HTMLElement>('*')).some(
            (child) => getComputedStyle(child).backgroundColor.replace(/\s+/g, ' ') === primaryTarget,
          );
          if (innerMatch || rect.width <= 80) {
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const r2 = el.getBoundingClientRect();
            return { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
          }
        }
      }
      return null;
    },
    { bg: targetBg, primary: targetPrimary },
  );

  expect(coords, `Expected palette swatch for ${primaryHex} / ${bgHex} to be rendered`).not.toBeNull();
  if (coords) {
    await page.mouse.click(coords.x, coords.y);
    await page.waitForTimeout(150);
  }
}

async function switchGroupInSchedule(page: Page, groupName: string): Promise<void> {
  const searchInput = page
    .getByPlaceholder(/групп|поиск|преподавател/i)
    .or(page.getByRole('searchbox'))
    .first();
  await expect(searchInput).toBeVisible({ timeout: 5000 });
  await searchInput.click();
  await searchInput.fill(groupName);
  const suggestion = page.getByText(new RegExp(`^${groupName}\\b`)).last();
  await expect(suggestion).toBeVisible({ timeout: 3000 });
  await suggestion.click();
}

test.describe('Tier 3 Pairwise — Auth, Schedule & Theme (T3-P01 .. T3-P08)', () => {
  test('T3-P01 (F9 x F10): Login updates login_group and loads student group schedule instead of default 510902', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'raw',
      clockDate: '2026-11-16T10:00:00',
    });

    // Override login response to return group 310101 for this student
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          fio: 'Волков Дмитрий Иванович',
          group: '310101',
          studentGroup: { name: '310101' },
          photoUrl: null,
        }),
      });
    });

    await loginAsStudent(page, {
      username: AUTH_CREDENTIALS.validUser,
      password: AUTH_CREDENTIALS.validPass,
    });

    // Schedule must display 310101 and its unique subject ИИиМО, not 510902
    await expect(page.getByText('310101').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });

    const schedRequests = api?.getRequestsMatching('/schedule') ?? [];
    expect(schedRequests.some((r) => r.url.includes('studentGroup=310101'))).toBe(true);
  });

  test('T3-P02 (F9 x F6): Network/CORS failure during Guest mode switches seamlessly to Offline/Mock schedule and Marks fallback', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      api: { abortAll: true },
      clockDate: '2026-11-16T10:00:00',
      mode: 'guest',
    });

    // Default fallback schedule 510902 renders cleanly despite blocked network
    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Switching to Marks renders fallback subjects/state without crashing
    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(/ОАиП|АиСД|Оценки/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P03 (F10 x F8): Switching groups recalculates active lesson timer and toggles Session pill based on group exams', async ({
    page,
  }) => {
    const refDate = new Date('2026-11-16T09:30:00');
    const active510902 = {
      ...createSessionActiveSchedule(refDate),
      studentGroupDto: GROUP_SCHEDULES['510902'].studentGroupDto,
    };

    await bootApp(page, {
      clockDate: refDate,
      mode: 'guest',
      api: {
        payloadOverrides: {
          groupSchedules: {
            ...GROUP_SCHEDULES,
            '510902': active510902,
          },
        },
      },
    });

    // 510902 at 09:30 -> ОАиП (09:00-10:25) is active AND Session pill is visible
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/До конца|Перерыв|2-я часть|\d+\s*(мин|м|сек)/i).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.schedule.sessionPill).first()).toBeVisible({
      timeout: 5000,
    });

    // Switch to 310101 which has exams: []
    await switchGroupInSchedule(page, '310101');
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/До конца|Перерыв|2-я часть|\d+\s*(мин|м|сек)/i).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.schedule.sessionPill)).toHaveCount(0);
  });

  test('T3-P04 (F10 x F13): Adding quick note from Lesson Detail Modal links subject and displays indicator on Schedule LessonCard', async ({
    page,
  }) => {
    await bootApp(page, {
      clockDate: '2026-11-16T08:30:00',
      mode: 'guest',
    });

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('ОАиП').first().click();

    const addNoteBtn = page.getByText(UI_LABELS.schedule.addNoteToLesson, { exact: false }).first();
    await expect(addNoteBtn).toBeVisible({ timeout: 5000 });
    await addNoteBtn.click();

    const noteText = 'Подготовить блок-схемы по ОАиП';
    const textInput = page
      .getByPlaceholder(/заметк/i)
      .or(page.locator('textarea'))
      .first();
    await expect(textInput).toBeVisible({ timeout: 5000 });
    await textInput.fill(noteText);

    await page.getByText(/Сохранить|Готово/i).first().click();

    // Schedule LessonCard immediately displays note preview or indicator
    await expect(page.getByText(noteText).first()).toBeVisible({ timeout: 5000 });

    // Confirm note exists under ОАиП in Notes tab
    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText(noteText).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P05 (F3 x F5): Dark -> Light -> Green/Mint palette updates BottomNavBar and LiquidGlass styling immediately', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Ensure Buttons nav mode so BottomNavBar is rendered
    const buttonsModeChip = page.getByText(UI_LABELS.customization.navButtons, { exact: true }).first();
    await buttonsModeChip.scrollIntoViewIfNeeded().catch(() => {});
    await buttonsModeChip.click();

    const bottomNav = page.locator('nav, [role="tablist"], [data-testid="bottom-nav"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 5000 });

    // Switch Dark -> Light
    await switchThemeMode(page, 'light');
    const lightLum = relativeLuminance(await getSurfaceBackgroundRgb(page));
    expect(lightLum).toBeGreaterThan(0.6);

    // Apply Green/Mint palette (#43A047 / #E8F5E9)
    await applyPaletteSwatch(
      page,
      RECOMMENDED_PALETTES.greenMint.primary,
      RECOMMENDED_PALETTES.greenMint.background,
    );

    const mintRgb = await getSurfaceBackgroundRgb(page);
    expect(mintRgb).toEqual(hexToRgbTuple(RECOMMENDED_PALETTES.greenMint.background));

    // BottomNavBar remains visible with LiquidGlass border/backdrop styling
    await expect(bottomNav).toBeVisible();
    const overflow = await checkNoHorizontalOverflow(page, 390);
    expect(overflow.ok).toBe(true);
  });

  test('T3-P06 (F3 x F10): Switching Dark -> Light -> Blue/Ice palette updates LessonCard, DateRail, and LiquidGlass modal cleanly', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await switchThemeMode(page, 'light');
    await applyPaletteSwatch(
      page,
      RECOMMENDED_PALETTES.blueIce.primary,
      RECOMMENDED_PALETTES.blueIce.background,
    );

    const iceRgb = await getSurfaceBackgroundRgb(page);
    expect(iceRgb).toEqual(hexToRgbTuple(RECOMMENDED_PALETTES.blueIce.background));

    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ЛК').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ЛР').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ПЗ').first()).toBeVisible({ timeout: 5000 });

    // Open Lesson Detail modal and verify LiquidGlass modal renders cleanly
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText('Учебные недели').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P07 (F2 x F3): Telegram colorScheme initializes theme while explicit user override persists on reload', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
      telegram: {
        mode: 'full',
        colorScheme: 'light',
        themeParams: {
          bg_color: ANDROID_THEMES.light.bg,
          text_color: ANDROID_THEMES.light.text,
          button_color: ANDROID_THEMES.light.accent,
        },
      },
    });

    // Initial theme respects Telegram colorScheme = 'light'
    expect(await isCurrentlyDark(page)).toBe(false);

    // User explicitly switches to Dark in Customization
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await switchThemeMode(page, 'dark');
    expect(await isCurrentlyDark(page)).toBe(true);

    // Reload page and confirm explicit Dark override wins over Telegram colorScheme: 'light'
    await page.reload();
    await page.waitForTimeout(300);
    expect(await isCurrentlyDark(page)).toBe(true);

    const tgLog = await getTelegramMockLog(page);
    expect(tgLog.some((e) => e.method === 'ready')).toBe(true);
  });

  test('T3-P08 (F1 x F22): Replaying intro from Customization launches BsuirIntroSplash and tap-to-skip restores Customization state', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await switchThemeMode(page, 'light');
    expect(await isCurrentlyDark(page)).toBe(false);

    const replayBtn = page.getByText(UI_LABELS.customization.replayIntro, { exact: false }).first();
    await replayBtn.scrollIntoViewIfNeeded().catch(() => {});
    await expect(replayBtn).toBeVisible({ timeout: 5000 });
    await replayBtn.click();

    // Splash appears
    const splashEl = page
      .locator('[data-testid="intro-splash"], canvas, [aria-label*="интро" i]')
      .first();
    await expect(splashEl).toBeVisible({ timeout: 3000 });

    // Tap to skip returns directly to Customization with Light state intact
    await page.mouse.click(195, 422);
    await expect(replayBtn).toBeVisible({ timeout: 5000 });
    expect(await isCurrentlyDark(page)).toBe(false);
  });
});
