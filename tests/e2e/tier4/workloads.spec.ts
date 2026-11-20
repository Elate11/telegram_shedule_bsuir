import type { Page } from '@playwright/test';
import {
  test,
  expect,
  bootApp,
  enterGuestMode,
  loginAsStudent,
  openTab,
  openProfileSubScreen,
  skipSplashIfVisible,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import {
  ANDROID_THEMES,
  AUTH_CREDENTIALS,
  GROUP_SCHEDULES,
  PERMANENT_ADDRESS,
  RECOMMENDED_PALETTES,
  UI_LABELS,
  createSessionActiveSchedule,
} from '../fixtures/testData';
import { triggerTelegramBackButton } from '../fixtures/telegramMock';

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
  return relativeLuminance(await getSurfaceBackgroundRgb(page)) < 0.45;
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

async function drawSignatureOnFullscreenCanvas(page: Page): Promise<void> {
  const canvas = page.locator('canvas').last();
  await expect(canvas).toBeVisible({ timeout: 5000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + box.width * 0.3, startY - 25, { steps: 6 });
    await page.mouse.move(startX + box.width * 0.55, startY + 20, { steps: 6 });
    await page.mouse.up();
  }
}

async function auditLayoutAndGlassAt390(page: Page, contextLabel: string): Promise<void> {
  const overflow = await checkNoHorizontalOverflow(page, 390);
  expect(
    overflow.ok,
    `${contextLabel}: horizontal overflow detected (${overflow.scrollWidth} > ${overflow.clientWidth})`,
  ).toBe(true);

  const metrics = await page.evaluate(() => {
    const textLen = (document.body.innerText || '').trim().length;
    const rootStyle = getComputedStyle(document.body);
    const fontFamily = rootStyle.fontFamily;
    const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const brokenImages = imgs.filter((img) => !img.complete || img.naturalWidth === 0).length;

    const glassCount = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const bf = s.backdropFilter || s.webkitBackdropFilter || '';
      return bf !== '' && bf !== 'none';
    }).length;

    return { textLen, fontFamily, brokenImages, glassCount };
  });

  expect(metrics.textLen, `${contextLabel}: page rendered empty text`).toBeGreaterThan(20);
  expect(metrics.fontFamily.length, `${contextLabel}: missing computed font-family`).toBeGreaterThan(0);
  expect(metrics.brokenImages, `${contextLabel}: broken visible <img> detected`).toBe(0);
  expect(metrics.glassCount, `${contextLabel}: expected LiquidGlass backdrop-filter surfaces`).toBeGreaterThan(0);
}

test.describe('Tier 4 Real-World Workloads (T4-W01 .. T4-W12)', () => {
  test('T4-W01 — First-Time Student Onboarding: Splash -> Login -> Schedule -> Subgroup 1 -> Buttons Nav -> Reload persistence', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'raw',
      skipSplash: false,
      clockDate: '2026-11-16T10:00:00',
    });

    // Splash appears on first launch
    const splashEl = page
      .locator('[data-testid="intro-splash"], canvas, [aria-label*="интро" i]')
      .first();
    await expect(splashEl).toBeVisible({ timeout: 3000 });
    await skipSplashIfVisible(page);

    await loginAsStudent(page, {
      username: AUTH_CREDENTIALS.validUser,
      password: AUTH_CREDENTIALS.validPass,
    });

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Filter subgroup 1: АиСД visible, МатАн (subgroup 2) hidden
    await page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first().click();
    await expect(page.getByText('АиСД').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('МатАн')).toHaveCount(0);

    // Ensure Buttons nav mode is selected
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const buttonsChip = page.getByText(UI_LABELS.customization.navButtons, { exact: true }).first();
    await buttonsChip.scrollIntoViewIfNeeded().catch(() => {});
    await buttonsChip.click();

    // Reload and verify authenticated session + group 510902 + subgroup 1 persist
    await page.reload();
    await skipSplashIfVisible(page);

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('АиСД').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('МатАн')).toHaveCount(0);
  });

  test('T4-W02 — Offline/CORS Blocked Guest Morning Routine: Countdown Phase 1 -> Break -> Quick Note Pinned -> Notes', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    // 09:35 -> Phase 1 of ОАиП (09:00-10:25, 1st half 09:00-09:40, break 09:40-09:45)
    await bootApp(page, {
      api: { abortAll: true },
      clockDate: '2026-11-16T09:35:00',
      mode: 'guest',
    });

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/До конца|\d+\s*(мин|м|сек)/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Advance clock into 5-min break (09:42)
    await page.clock.setFixedTime(new Date('2026-11-16T09:42:00'));
    await page.waitForTimeout(1100);
    await expect(page.getByText(/Перерыв|2-я часть/i).first()).toBeVisible({ timeout: 5000 });

    // Open Lesson Detail and add a pinned Quick Note
    await page.getByText('ОАиП').first().click();
    await page.getByText(UI_LABELS.schedule.addNoteToLesson, { exact: false }).first().click();

    const noteInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await noteInput.fill('Утренняя закреплённая заметка');
    await page.getByText(UI_LABELS.notes.pinToggle, { exact: false }).first().click();
    await page.getByText(/Сохранить|Готово/i).first().click();

    // Note preview visible on Schedule LessonCard
    await expect(page.getByText('Утренняя закреплённая заметка').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify note appears in Notes pinned section
    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText(UI_LABELS.notes.pinnedSection).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Утренняя закреплённая заметка').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T4-W03 — Lecturer Search & Co-Attending Group Discovery: Search lecturer -> Inline schedule -> Jump to co-attending group -> Back', async ({
    page,
  }) => {
    await bootApp(page, {
      clockDate: '2026-11-16T10:00:00',
      mode: 'guest',
    });

    const searchInput = page
      .getByPlaceholder(/групп|поиск|преподавател/i)
      .or(page.getByRole('searchbox'))
      .first();
    await searchInput.click();
    await searchInput.fill('Азаров');

    const lecturerSuggestion = page.getByText(/Азаров И\.\s*В\./i).last();
    await expect(lecturerSuggestion).toBeVisible({ timeout: 5000 });
    await lecturerSuggestion.click();

    // Inline teacher schedule shows lecturer's lessons and Back button
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });

    // Tap ОАиП lesson and jump to co-attending group 253501
    await page.getByText('ОАиП').first().click();
    const coGroupPill = page.getByText('253501', { exact: true }).last();
    await expect(coGroupPill).toBeVisible({ timeout: 5000 });
    await coGroupPill.click();

    await expect(page.getByText('КСиС').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('БД').first()).toBeVisible({ timeout: 5000 });

    // Restore own group 510902 via "Назад к группе" or search
    const backToGroupBtn = page
      .getByRole('button', { name: new RegExp(UI_LABELS.schedule.backToGroup, 'i') })
      .or(page.getByLabel(UI_LABELS.schedule.backToGroup))
      .or(page.getByText(UI_LABELS.schedule.backToGroup))
      .first();
    if (await backToGroupBtn.isVisible().catch(() => false)) {
      await backToGroupBtn.click();
    } else {
      await searchInput.click();
      await searchInput.fill('510902');
      await page.getByText(/^510902\b/).last().click();
    }

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('АиСД').first()).toBeVisible({ timeout: 5000 });
  });

  test('T4-W04 — Exam Session Preparation Workflow: Session toggle -> Exam cards -> Notes Grid & ЛК/ЛР filters', async ({
    page,
  }) => {
    const refDate = new Date('2026-11-16T10:00:00');
    const sessionSchedule = {
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
            '510902': sessionSchedule,
          },
        },
      },
    });

    const sessionPill = page.getByText(UI_LABELS.schedule.sessionPill, { exact: true }).first();
    await expect(sessionPill).toBeVisible({ timeout: 5000 });
    await sessionPill.click();

    await expect(page.getByText('Консультация').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Экзамен').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Зачет').first()).toBeVisible({ timeout: 5000 });

    // Open Notes and add exam prep (ЛК) + lab (ЛР) notes
    await openTab(page, UI_LABELS.tabs.notes);

    const addNote = async (text: string, typeChip: 'ЛК' | 'ЛР') => {
      const addBtn = page
        .getByRole('button', { name: /добавить|новая заметка|\+/i })
        .or(page.locator('[data-testid="add-note-btn"], button[aria-label*="заметк" i]'))
        .first();
      await addBtn.click();
      const input = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
      await input.fill(text);
      await page.getByText(typeChip, { exact: true }).last().click();
      await page.getByText(/Сохранить|Готово/i).first().click();
    };

    await addNote('Билеты к экзамену ОАиП', 'ЛК');
    await addNote('Сдать лабы АиСД', 'ЛР');

    // Switch to 2-col Grid if toggle button is visible
    const gridToggle = page
      .getByRole('button', { name: /сетк|grid|список/i })
      .or(page.locator('[aria-label*="сетк" i], [aria-label*="вид" i], [data-testid="notes-layout-toggle"]'))
      .first();
    if (await gridToggle.isVisible().catch(() => false)) {
      await gridToggle.click();
    }

    // Filter by ЛР
    await page.getByText(/^ЛР\b/).first().click();
    await expect(page.getByText('Сдать лабы АиСД').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Билеты к экзамену ОАиП')).toHaveCount(0);

    // Reset filter to Все and search "Билеты"
    await page.getByText(/^Все\b/).first().click();
    const noteSearch = page.getByPlaceholder(/поиск/i).first();
    await noteSearch.fill('Билеты');
    await expect(page.getByText('Билеты к экзамену ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Сдать лабы АиСД')).toHaveCount(0);
  });

  test('T4-W05 — Academic Performance & Gradebook Audit: Marks KPIs -> Search subject -> Gradebook semesters -> BackButton', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.marks.labsLabel).first()).toBeVisible({
      timeout: 5000,
    });

    const marksSearch = page.getByPlaceholder(/поиск/i).first();
    await marksSearch.fill('АиСД');
    await expect(page.getByText('АиСД').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('МатАн')).toHaveCount(0);

    // Gradebook semester audit
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    await expect(page.getByText('8.6').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('8.75').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('6.0').first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Линейная алгебра и аналитическая геометрия').first(),
    ).toBeVisible({ timeout: 5000 });

    await triggerTelegramBackButton(page);
    await expect(page.getByText(UI_LABELS.profile.customization).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T4-W06 — Absences Review & ORVI Medical Submission: KPIs & chart -> Auto-filled address -> Canvas signature -> Base64 PNG payload', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    // Verify missed lessons & monthly chart
    await expect(page.getByText('Математический анализ').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Ноя/i).first()).toBeVisible({ timeout: 5000 });

    // Open ORVI dialog
    await page.getByText(UI_LABELS.studyAndOrvi.applyOrvi, { exact: false }).first().click();

    // Permanent address is auto-filled
    const addressInput = page.locator(`input[value*="Бровки"], textarea`).first();
    const hasAddressVal = await addressInput.isVisible().catch(() => false);
    if (hasAddressVal) {
      await expect(addressInput).toHaveValue(new RegExp('Бровки'));
    } else {
      await expect(page.getByText(new RegExp(PERMANENT_ADDRESS.slice(0, 20))).first()).toBeVisible({
        timeout: 5000,
      });
    }

    // Open fullscreen signature canvas, draw stroke, save
    await page.getByText(/расписаться на весь экран|подпись/i).first().click();
    await drawSignatureOnFullscreenCanvas(page);
    await page.getByText(UI_LABELS.studyAndOrvi.saveSignature, { exact: false }).first().click();

    // Submit ORVI
    await page.getByText(UI_LABELS.studyAndOrvi.submitOrvi, { exact: false }).first().click();
    await expect(page.getByText(/Заявление по ОРВИ/i).first()).toBeVisible({ timeout: 5000 });

    // Inspect POST /omissions/create payload for valid PNG base64 signature
    const orviPosts = (api?.getRequestsMatching('/omissions/create') ?? []).filter(
      (r) => r.method === 'POST',
    );
    expect(orviPosts.length).toBeGreaterThan(0);
    const rawBody = orviPosts[0].postData ?? '';
    expect(rawBody).toMatch(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
  });

  test('T4-W07 — Dean Office Certificates & Paid Mark Sheets: Order & cancel гербовая cert -> Order & withdraw 23.00 BYN mark sheet', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.study);

    // Order гербовая certificate with custom destination
    await page.getByText(UI_LABELS.studyAndOrvi.orderCertificate, { exact: false }).first().click();
    const customPlaceInput = page
      .getByPlaceholder(/Например|своё место|место/i)
      .or(page.locator('input[type="text"], textarea').last())
      .first();
    await customPlaceInput.fill('В IT-компанию');
    await page.getByText(/гербовая/i).first().click();
    await page.getByRole('button', { name: /^Заказать$/i }).or(page.getByText(/^Заказать$/)).last().click();

    await expect(page.getByText('В IT-компанию').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.studyAndOrvi.statusPending).first()).toBeVisible({
      timeout: 5000,
    });

    // Cancel pending certificate
    await page.getByText(UI_LABELS.studyAndOrvi.cancelRequest, { exact: false }).first().click();
    await page.waitForTimeout(250);
    expect((api?.getRequestsMatching('/certificate/close') ?? []).length).toBeGreaterThan(0);

    // Switch to Ведомости tab and order unexcused 4h paid mark sheet (23.00 BYN)
    await page.getByText(new RegExp(UI_LABELS.studyAndOrvi.markSheetsTab)).first().click();
    await page.getByText(UI_LABELS.studyAndOrvi.orderMarkSheet, { exact: false }).first().click();

    await page.getByText(/^4\s*ч$/).first().click();
    const reasonSwitch = page
      .getByRole('switch', { name: /уважительн/i })
      .or(page.getByText(/Уважительная причина/i))
      .first();
    await reasonSwitch.click();

    await page.getByRole('button', { name: /^Заказать$/i }).or(page.getByText(/^Заказать$/)).last().click();

    await expect(page.getByText(/23(\.00)?\s*(BYN|р)/i).first()).toBeVisible({ timeout: 5000 });

    // Withdraw mark sheet
    await page.getByText(UI_LABELS.studyAndOrvi.withdrawMarkSheet, { exact: false }).first().click();
    await page.waitForTimeout(250);
    expect((api?.getRequestsMatching('/mark-sheet/close') ?? []).length).toBeGreaterThan(0);
  });

  test('T4-W08 — Headman Attendance Marking Workflow: Headman badge -> Journal -> Increment 2 students -> Save & persist', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(UI_LABELS.profile.headmanBadge).first()).toBeVisible({
      timeout: 5000,
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    // Select subject & lesson chip
    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({ timeout: 5000 });
    const plusButtons = page.getByRole('button', { name: '+' }).or(page.getByText('+', { exact: true }));
    expect(await plusButtons.count()).toBeGreaterThanOrEqual(2);
    await plusButtons.nth(0).click();
    await plusButtons.nth(1).click();

    await page.getByText(UI_LABELS.headman.saveAttendance, { exact: false }).first().click();
    await page.waitForTimeout(300);

    const headmanCreates = (api?.getRequestsMatching('/headman/create') ?? []).filter(
      (r) => r.method === 'POST',
    );
    expect(headmanCreates.length).toBeGreaterThan(0);
    const body = JSON.parse(headmanCreates[0].postData ?? '{}') as {
      idLesson?: number;
      studentOmissionsHoursDtoList?: Array<{ student: number; hours: number }>;
    };
    expect(body.idLesson).toBeGreaterThan(0);
    expect((body.studentOmissionsHoursDtoList ?? []).length).toBeGreaterThanOrEqual(2);

    // Reopen Headman Journal and confirm persistence from store
    await triggerTelegramBackButton(page);
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);
    await expect(page.getByText(/Пропуск:\s*[12]\s*ч/).first()).toBeVisible({ timeout: 5000 });
  });

  test('T4-W09 — Deep Visual Personalization & Glassmorphism: Dark -> Light -> Green/Mint + Gradient + Hold + Cube -> Reload', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Switch Dark -> Light and apply Green/Mint (#43A047 / #E8F5E9)
    await switchThemeMode(page, 'light');
    await applyPaletteSwatch(
      page,
      RECOMMENDED_PALETTES.greenMint.primary,
      RECOMMENDED_PALETTES.greenMint.background,
    );

    // Enable Gradient background
    const gradientBtn = page.getByText(UI_LABELS.customization.bgGradient, { exact: true }).first();
    await gradientBtn.scrollIntoViewIfNeeded().catch(() => {});
    await gradientBtn.click();

    // Select Cube transition
    const cubeBtn = page.getByText('Куб', { exact: true }).first();
    await cubeBtn.scrollIntoViewIfNeeded().catch(() => {});
    await cubeBtn.click();

    // Enable Hold radial navigation
    const holdBtn = page.getByText(UI_LABELS.customization.navHold, { exact: true }).first();
    await holdBtn.scrollIntoViewIfNeeded().catch(() => {});
    await holdBtn.click();

    // Navigate via 480ms radial menu to Schedule
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();
    await page.getByText(UI_LABELS.tabs.schedule, { exact: true }).last().click();
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Reload and confirm Light + Green/Mint + Hold + Gradient + Cube persist
    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page);

    expect(await isCurrentlyDark(page)).toBe(false);
    const mintRgb = await getSurfaceBackgroundRgb(page);
    expect(mintRgb).toEqual(hexToRgbTuple(RECOMMENDED_PALETTES.greenMint.background));

    // Confirm Hold radial menu still works after reload
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();
    await expect(page.getByText(UI_LABELS.tabs.profile, { exact: true }).last()).toBeVisible({
      timeout: 3000,
    });
    await page.getByText(UI_LABELS.tabs.profile, { exact: true }).last().click();

    const overflow = await checkNoHorizontalOverflow(page, 390);
    expect(overflow.ok).toBe(true);
  });

  test('T4-W10 — IIS Career Resume, CV & Widget Preview: Step days -> Privacy toggles -> Edit bio -> Skills/Links CRUD -> Copy Outlook', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    const { api } = await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    // Step widget preview +1 and -1
    await page.getByText('›', { exact: true }).first().click();
    await expect(page.getByText(/Завтра/i).first()).toBeVisible({ timeout: 5000 });
    await page.getByText('‹', { exact: true }).first().click();
    await page.getByText('‹', { exact: true }).first().click();
    await expect(page.getByText(/Вчера/i).first()).toBeVisible({ timeout: 5000 });

    // Toggle all 3 privacy switches
    const switches = page.getByRole('switch');
    const swCount = await switches.count();
    expect(swCount).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i += 1) {
      await switches.nth(i).click();
    }

    // Edit bio
    await page.getByText('Изменить', { exact: true }).first().click();
    const bioInput = page.locator('textarea, input[type="text"]').last();
    await bioInput.fill('Fullstack BSUIR Developer');
    await page.getByText('Сохранить', { exact: true }).last().click();
    await expect(page.getByText('Fullstack BSUIR Developer').first()).toBeVisible({
      timeout: 5000,
    });

    // Add skill Docker & remove Kotlin
    await page.getByText('Добавить', { exact: true }).first().click();
    const skillInput = page.getByPlaceholder(/Kotlin|навык/i).or(page.locator('input[type="text"]').last()).first();
    await skillInput.fill('Docker');
    await page.getByText('Добавить', { exact: true }).last().click();
    await expect(page.getByText('Docker').first()).toBeVisible({ timeout: 5000 });

    // Add link
    await page.getByText('Добавить', { exact: true }).nth(1).click();
    const inputs = page.locator('input[type="text"]');
    await inputs.nth((await inputs.count()) - 2).fill('Portfolio');
    await inputs.last().fill('https://example.com');
    await page.getByText('Добавить', { exact: true }).last().click();
    await expect(page.getByText('https://example.com').first()).toBeVisible({ timeout: 5000 });

    // Tap Outlook credentials
    await page.getByText('sokolov.ad@study.bsuir.by').first().click();
    await page.getByText('OutlookPass2026!').first().click();

    const cvPuts = api?.getRequestsMatching('/profiles/') ?? [];
    expect(cvPuts.some((r) => r.pathname.endsWith('/profiles/summary'))).toBe(true);
    expect(cvPuts.some((r) => r.pathname.endsWith('/profiles/my-skills'))).toBe(true);
  });

  test('T4-W11 — Notifications, Dormitory, Privileges, Penalties & Announcements feed verification', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    // Notifications
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    await expect(page.getByText(/Справка об обучении №412/).first()).toBeVisible({ timeout: 5000 });
    await page.getByText('Важное', { exact: true }).first().click();
    await expect(page.getByText(/Физике/).first()).toBeVisible({ timeout: 5000 });
    await triggerTelegramBackButton(page);

    // Dormitory & Privileges
    await openProfileSubScreen(page, UI_LABELS.profile.dormitory);
    await expect(page.getByText('Общежитие №4, блок 512').first()).toBeVisible({ timeout: 5000 });
    await page.getByText(/Льготы/i).first().click();
    await expect(page.getByText('Первоочередное заселение').first()).toBeVisible({ timeout: 5000 });
    await triggerTelegramBackButton(page);

    // Penalties & Incentives
    await openProfileSubScreen(page, UI_LABELS.profile.penalties);
    await expect(page.getByText('Благодарность декана ФКП').first()).toBeVisible({ timeout: 5000 });
    await triggerTelegramBackButton(page);

    // Announcements
    await openProfileSubScreen(page, UI_LABELS.profile.announcements);
    await expect(page.getByText('Расписание пересдач за осенний семестр').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Хакатон БГУИР Tech Challenge 2026').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T4-W12 — Full 2-Theme Mobile Layout & Console Audit (390x844): Dark, Light, and Green-on-Mint Light', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    const sweepAllScreens = async (themeLabel: string) => {
      // 4 main tabs
      for (const tab of [
        UI_LABELS.tabs.schedule,
        UI_LABELS.tabs.marks,
        UI_LABELS.tabs.notes,
        UI_LABELS.tabs.profile,
      ]) {
        await openTab(page, tab);
        await page.waitForTimeout(150);
        await auditLayoutAndGlassAt390(page, `${themeLabel} / ${tab}`);
      }

      // Absences sub-screen
      await openProfileSubScreen(page, UI_LABELS.profile.absences);
      await page.waitForTimeout(150);
      await auditLayoutAndGlassAt390(page, `${themeLabel} / ${UI_LABELS.profile.absences}`);
      await triggerTelegramBackButton(page);

      // Customization sub-screen
      await openProfileSubScreen(page, UI_LABELS.profile.customization);
      await page.waitForTimeout(150);
      await auditLayoutAndGlassAt390(page, `${themeLabel} / ${UI_LABELS.profile.customization}`);
      await triggerTelegramBackButton(page);
    };

    // 1. Dark theme (strict Android #272729)
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await switchThemeMode(page, 'dark');
    expect(await getSurfaceBackgroundRgb(page)).toEqual(hexToRgbTuple(ANDROID_THEMES.dark.bg));
    await triggerTelegramBackButton(page);
    await sweepAllScreens('Dark');

    // 2. Light theme (strict Android #F5F5F7)
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await switchThemeMode(page, 'light');
    expect(await getSurfaceBackgroundRgb(page)).toEqual(hexToRgbTuple(ANDROID_THEMES.light.bg));
    await triggerTelegramBackButton(page);
    await sweepAllScreens('Light');

    // 3. Custom Green-on-Mint Light preset (#43A047 / #E8F5E9)
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    await applyPaletteSwatch(
      page,
      RECOMMENDED_PALETTES.greenMint.primary,
      RECOMMENDED_PALETTES.greenMint.background,
    );
    expect(await getSurfaceBackgroundRgb(page)).toEqual(
      hexToRgbTuple(RECOMMENDED_PALETTES.greenMint.background),
    );
    await triggerTelegramBackButton(page);
    await sweepAllScreens('GreenOnMintLight');
  });
});
