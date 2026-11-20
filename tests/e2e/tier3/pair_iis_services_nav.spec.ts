import type { Page } from '@playwright/test';
import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
} from '../fixtures/appHarness';
import { PERSONAL_CV, UI_LABELS } from '../fixtures/testData';
import { getTelegramState, triggerTelegramBackButton } from '../fixtures/telegramMock';

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

test.describe('Tier 3 Pairwise — IIS Services, Profile & Navigation (T3-P17 .. T3-P24)', () => {
  test('T3-P17 (F14 x F19): Headman student sees "Журнал старосты" on Profile and loads live /headman/* data', async ({
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
    await expect(page.getByText(UI_LABELS.profile.headmanJournal).first()).toBeVisible({
      timeout: 5000,
    });

    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText(/ОАиП/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Громов Артём Иванович').first()).toBeVisible({ timeout: 5000 });

    const headmanReqs = api?.getRequestsMatching('/headman/') ?? [];
    expect(headmanReqs.some((r) => r.pathname.endsWith('/headman/subjects'))).toBe(true);
    expect(headmanReqs.some((r) => r.pathname.endsWith('/headman/students'))).toBe(true);
    expect(headmanReqs.some((r) => r.pathname.endsWith('/headman/data'))).toBe(true);
  });

  test('T3-P18 (F14 x F15): Reading Notifications dispatches PATCH /notifications and updates unread badge on Profile', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.profile);
    const notifRow = page.getByText(UI_LABELS.profile.notifications, { exact: false }).first();
    await expect(notifRow).toBeVisible({ timeout: 5000 });

    // Unread count initially 2
    await expect(page.getByText(/^2$/).first()).toBeVisible({ timeout: 5000 });

    await notifRow.click();
    await expect(
      page.getByText(/пересдача экзамена|Справка об обучении №412/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Verify PATCH /notifications fired
    await page.waitForTimeout(300);
    const patchCalls = (api?.getRequestsMatching('/notifications') ?? []).filter(
      (r) => r.method === 'PATCH',
    );
    expect(patchCalls.length).toBeGreaterThan(0);

    // Navigate back to Profile and confirm unread badge count updated to 0/removed
    await triggerTelegramBackButton(page);
    await expect(page.getByText(UI_LABELS.profile.notifications).first()).toBeVisible({
      timeout: 5000,
    });
    const storeUnread = api?.getStore().notifications.filter((n) => !n.isViewed).length ?? -1;
    expect(storeUnread).toBe(0);
  });

  test('T3-P19 (F14 x F2): Entering Profile sub-screens shows Telegram BackButton and clicking it pops back & hides BackButton', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      telegram: { mode: 'full' },
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.profile);
    expect((await getTelegramState(page)).backButtonVisible).toBe(false);

    for (const subLabel of [
      UI_LABELS.profile.gradebook,
      UI_LABELS.profile.absences,
      UI_LABELS.profile.iisResume,
    ]) {
      await openProfileSubScreen(page, subLabel);
      await page.waitForTimeout(150);
      expect((await getTelegramState(page)).backButtonVisible).toBe(true);

      await triggerTelegramBackButton(page);
      await page.waitForTimeout(150);
      await expect(page.getByText(UI_LABELS.profile.customization).first()).toBeVisible({
        timeout: 5000,
      });
      expect((await getTelegramState(page)).backButtonVisible).toBe(false);
    }
  });

  test('T3-P20 (F16 x F17): Ordering a Certificate and submitting ORVI updates Study & Absences lists cleanly', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    // Order a Certificate in Study (F16)
    await openProfileSubScreen(page, UI_LABELS.profile.study);
    await page.getByText(UI_LABELS.studyAndOrvi.orderCertificate, { exact: false }).first().click();

    const customPlaceInput = page
      .getByPlaceholder(/Например|своё место|место/i)
      .or(page.locator('input[type="text"], textarea').last())
      .first();
    await expect(customPlaceInput).toBeVisible({ timeout: 5000 });
    await customPlaceInput.fill('В банк БПС-Сбербанк');
    await page.getByRole('button', { name: /^Заказать$/i }).or(page.getByText(/^Заказать$/)).last().click();

    await expect(page.getByText('В банк БПС-Сбербанк').first()).toBeVisible({ timeout: 5000 });

    // Navigate back to Profile -> Absences (F17) -> submit ORVI
    await triggerTelegramBackButton(page);
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    await page.getByText(UI_LABELS.studyAndOrvi.applyOrvi, { exact: false }).first().click();
    await page.getByText(/расписаться на весь экран|подпись/i).first().click();
    await drawSignatureOnFullscreenCanvas(page);
    await page.getByText(UI_LABELS.studyAndOrvi.saveSignature, { exact: false }).first().click();
    await page.getByText(UI_LABELS.studyAndOrvi.submitOrvi, { exact: false }).first().click();

    await expect(page.getByText(/Заявление по ОРВИ/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P21 (F18 x F14): Profile group & headman badges match Group screen student roster "ВЫ" entry', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.profile.headmanBadge).first()).toBeVisible({
      timeout: 5000,
    });

    await openProfileSubScreen(page, UI_LABELS.profile.group);
    await expect(page.getByText('Азаров Игорь Викторович').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Соколов Алексей Дмитриевич').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.profile.meBadge, { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.profile.headmanBadge).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T3-P22 (F21 x F10): Changing active group and subgroup in Schedule reflects in IIS Resume Widget Preview', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await switchGroupInSchedule(page, '310101');
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });
    await page.getByText(UI_LABELS.schedule.subgroup2, { exact: true }).first().click();

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText('310101').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/2 подгр/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/ИИиМО|Нейросети/).first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P23 (F21 x F14): Updating CV summary and skills in IIS Resume persists after returning to Profile and reopening', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);
    await expect(page.getByText(PERSONAL_CV.summary).first()).toBeVisible({ timeout: 5000 });

    // Edit bio ("О себе" -> "Изменить")
    await page.getByText('Изменить', { exact: true }).first().click();
    const bioInput = page.locator('textarea, input[type="text"]').last();
    await expect(bioInput).toBeVisible({ timeout: 3000 });
    await bioInput.fill('Senior Frontend Engineer (React 19)');
    await page.getByText('Сохранить', { exact: true }).last().click();
    await expect(page.getByText('Senior Frontend Engineer (React 19)').first()).toBeVisible({
      timeout: 5000,
    });

    // Add a skill ("Навыки" -> "Добавить")
    const addBtns = page.getByText('Добавить', { exact: true });
    await addBtns.first().click();
    const skillInput = page.getByPlaceholder(/Kotlin|навык/i).or(page.locator('input[type="text"]').last()).first();
    await expect(skillInput).toBeVisible({ timeout: 3000 });
    await skillInput.fill('Playwright');
    await page.getByText('Добавить', { exact: true }).last().click();
    await expect(page.getByText('Playwright').first()).toBeVisible({ timeout: 5000 });

    // Pop back to Profile and reopen IIS Resume
    await triggerTelegramBackButton(page);
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText('Senior Frontend Engineer (React 19)').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Playwright').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P24 (F11 x F12): Authenticated student GPA in Marks and semester marks in Gradebook reflect /markbook consistently', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });

    // Inspect Marks tab
    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Inspect Gradebook screen
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    await expect(page.getByText('8.6').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('8.75').first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Линейная алгебра и аналитическая геометрия').first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Дискретная математика').first()).toBeVisible({ timeout: 5000 });
  });
});
