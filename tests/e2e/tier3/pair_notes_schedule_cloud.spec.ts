import type { Page } from '@playwright/test';
import {
  test,
  expect,
  bootApp,
  clearStorage,
  enterGuestMode,
  openTab,
  openProfileSubScreen,
  skipSplashIfVisible,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';
import { getCloudStorageSnapshot, getTelegramMockLog } from '../fixtures/telegramMock';

async function openNewNoteModal(page: Page): Promise<void> {
  const addBtn = page
    .getByRole('button', { name: /добавить|новая заметка|\+/i })
    .or(page.locator('[data-testid="add-note-btn"], button[aria-label*="заметк" i]'))
    .first();
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  await expect(page.getByText('Новая заметка').first()).toBeVisible({ timeout: 5000 });
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

test.describe('Tier 3 Pairwise — Notes, Schedule & CloudStorage (T3-P09 .. T3-P16)', () => {
  test('T3-P09 (F13 x F8): New note uses findNextLessonForSubject ("К след. паре") to populate date and time', async ({
    page,
  }) => {
    // Monday 08:00: АиСД (ЛР) is scheduled at 10:35
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T08:00:00',
    });

    await openTab(page, UI_LABELS.tabs.notes);
    await openNewNoteModal(page);

    // Pick subject АиСД inside note modal
    const subjectSelector = page
      .getByRole('button', { name: /Общее|ОАиП|АиСД|Предмет/i })
      .or(page.getByText(/^Общее$|^ОАиП$/))
      .first();
    await subjectSelector.click();
    await page.getByText(/^АиСД$/).last().click();

    // Tap "К след. паре" shortcut chip
    const nextLessonChip = page
      .getByText(new RegExp(UI_LABELS.notes.nextLessonShortcut, 'i'))
      .first();
    await expect(nextLessonChip).toBeVisible({ timeout: 5000 });
    await nextLessonChip.click();

    // Time chip updates to 10:35 (startLessonTime of АиСД ЛР)
    await expect(page.getByText('10:35').first()).toBeVisible({ timeout: 3000 });

    const noteInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await noteInput.fill('Защита лабы АиСД');
    await page.getByText(/Сохранить|Готово/i).first().click();

    await expect(page.getByText('Защита лабы АиСД').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('10:35').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P10 (F13 x F7): Creating, pinning, and editing a Note syncs to CloudStorage and survives reload after localStorage clear', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
      telegram: { mode: 'full' },
    });

    await openTab(page, UI_LABELS.tabs.notes);
    await openNewNoteModal(page);

    const noteInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await noteInput.fill('Облачная заметка v1');
    await page.getByText(UI_LABELS.notes.pinToggle, { exact: false }).first().click();
    await page.getByText(/Сохранить|Готово/i).first().click();

    await expect(page.getByText('Облачная заметка v1').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.notes.pinnedSection).first()).toBeVisible({
      timeout: 5000,
    });

    // Open note to edit
    await page.getByText('Облачная заметка v1').first().click();
    const editInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await expect(editInput).toBeVisible({ timeout: 5000 });
    await editInput.fill('Облачная заметка v2');
    await page.getByText(/Сохранить|Готово/i).first().click();

    await expect(page.getByText('Облачная заметка v2').first()).toBeVisible({ timeout: 5000 });

    // Verify CloudStorage.setItem recorded and snapshot contains updated text
    await page.waitForTimeout(250);
    const tgLog = await getTelegramMockLog(page);
    expect(tgLog.some((e) => e.method === 'CloudStorage.setItem')).toBe(true);

    const cloudSnapshot = await getCloudStorageSnapshot(page);
    const serialized = JSON.stringify(cloudSnapshot);
    expect(serialized).toContain('Облачная заметка v2');

    // Clear localStorage completely, reload, and verify note restores from CloudStorage
    await clearStorage(page);
    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page);

    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText('Облачная заметка v2').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.notes.pinnedSection).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T3-P11 (F13 x F22): Reminder timing in Customization applies to event notes and test notification trigger', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const twoHoursOpt = page.getByText(/За 2 часа/i).first();
    await twoHoursOpt.scrollIntoViewIfNeeded().catch(() => {});
    await expect(twoHoursOpt).toBeVisible({ timeout: 5000 });
    await twoHoursOpt.click();

    const customOpt = page.getByText(/Свой вариант/i).first();
    await expect(customOpt).toBeVisible({ timeout: 5000 });
    await customOpt.click();

    // Increment custom hours from 3 to 4
    const plusBtn = page.getByRole('button', { name: '+' }).or(page.getByText('+', { exact: true })).first();
    await expect(plusBtn).toBeVisible({ timeout: 3000 });
    await plusBtn.click();
    await expect(page.getByText(/4\s*ч\./).first()).toBeVisible({ timeout: 3000 });

    // Trigger test notification
    const testNotifBtn = page.getByText(UI_LABELS.customization.testNotification, { exact: false }).first();
    await expect(testNotifBtn).toBeVisible({ timeout: 3000 });
    await testNotifBtn.click();
    await expect(page.getByText(/Напоминание|4 ч/i).first()).toBeVisible({ timeout: 5000 });

    // Create event note with "Напомнить"
    await openTab(page, UI_LABELS.tabs.notes);
    await openNewNoteModal(page);
    const noteInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await noteInput.fill('Контрольная с напоминанием');
    await page.getByText(UI_LABELS.notes.remindToggle, { exact: false }).first().click();
    await page.getByText(/Сохранить|Готово/i).first().click();

    await expect(page.getByText('Контрольная с напоминанием').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P12 (F10 x F7): Selecting subgroup 2 and searching 2 groups persists both subgroup and group_history across reload', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
      telegram: { mode: 'full' },
    });

    await switchGroupInSchedule(page, '310101');
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });

    await switchGroupInSchedule(page, '510902');
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Select subgroup 2
    await page.getByText(UI_LABELS.schedule.subgroup2, { exact: true }).first().click();
    await expect(page.getByText('МатАн').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('АиСД')).toHaveCount(0);

    // Reload and verify group, subgroup 2 filter, and search history persist
    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page);

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('МатАн').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('АиСД')).toHaveCount(0);

    const searchInput = page
      .getByPlaceholder(/групп|поиск|преподавател/i)
      .or(page.getByRole('searchbox'))
      .first();
    await searchInput.click();
    await expect(page.getByText(/310101/).first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P13 (F11 x F10): Switching active group in Schedule updates guest subject skeletons on Marks', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(/ОАиП|АиСД/).first()).toBeVisible({ timeout: 5000 });

    await openTab(page, UI_LABELS.tabs.schedule);
    await switchGroupInSchedule(page, '310101');
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(/ИИиМО|ТФЯ|Нейросети/).first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P14 (F4 x F13): Using IosDatePickerModal and IosTimePickerModal inside Note modal persists dd.MM.yyyy and HH:mm', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.notes);
    await openNewNoteModal(page);

    const noteInput = page.getByPlaceholder(/заметк/i).or(page.locator('textarea')).first();
    await noteInput.fill('Заметка с пикером');

    // Open IosDatePickerModal via current date chip (dd.MM.yyyy)
    const dateChip = page.getByText(/\d{2}\.\d{2}\.\d{4}/).first();
    await expect(dateChip).toBeVisible({ timeout: 5000 });
    await dateChip.click();

    // Pick day 25 in calendar grid and confirm if there is a Done/Выбрать button
    const day25 = page.getByRole('button', { name: /^25$/ }).or(page.getByText(/^25$/)).last();
    await expect(day25).toBeVisible({ timeout: 3000 });
    await day25.click();
    const dateConfirm = page.getByRole('button', { name: /Готово|Выбрать|Ок/i }).first();
    if (await dateConfirm.isVisible().catch(() => false)) {
      await dateConfirm.click();
    }

    // Open IosTimePickerModal via time chip (HH:mm)
    const timeChip = page.getByText(/^\d{2}:\d{2}$/).first();
    await expect(timeChip).toBeVisible({ timeout: 5000 });
    await timeChip.click();

    const timeDialog = page.getByRole('dialog').last();
    await expect(timeDialog).toBeVisible({ timeout: 3000 });

    const hour14 = timeDialog.getByRole('button', { name: /^14$/ }).or(timeDialog.getByText(/^14$/)).first();
    await hour14.scrollIntoViewIfNeeded().catch(() => {});
    await expect(hour14).toBeVisible({ timeout: 3000 });
    await hour14.click();

    const min30 = timeDialog.getByRole('button', { name: /^30$/ }).or(timeDialog.getByText(/^30$/)).first();
    await min30.scrollIntoViewIfNeeded().catch(() => {});
    await expect(min30).toBeVisible({ timeout: 3000 });
    await min30.click();

    const timeConfirm = timeDialog.getByRole('button', { name: /Готово|Выбрать|Ок/i }).first();
    await expect(timeConfirm).toBeVisible({ timeout: 3000 });
    await timeConfirm.click();

    await page.getByText(/Сохранить|Готово/i).first().click();

    await expect(page.getByText('Заметка с пикером').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/25\.11\.2026|25\.11/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('14:30').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3-P15 (F5 x F10): Hold 480ms opens AppleRadialMenu -> navigate to Notes -> switch to Buttons nav renders bottom bar on all 4 tabs', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    // Enable Hold navigation mode in Customization
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const holdChip = page.getByText(UI_LABELS.customization.navHold, { exact: true }).first();
    await holdChip.scrollIntoViewIfNeeded().catch(() => {});
    await holdChip.click();

    // Return to Schedule via hold gesture
    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Perform 480ms+ pointer hold on Schedule to summon AppleRadialMenu
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();

    const radialNotes = page.getByText(UI_LABELS.tabs.notes, { exact: true }).last();
    await expect(radialNotes).toBeVisible({ timeout: 3000 });
    await radialNotes.click();
    await expect(page.getByText(/Заметки/i).first()).toBeVisible({ timeout: 5000 });

    // Switch back to Buttons nav mode in Customization
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const buttonsChip = page.getByText(UI_LABELS.customization.navButtons, { exact: true }).first();
    await buttonsChip.scrollIntoViewIfNeeded().catch(() => {});
    await buttonsChip.click();

    // Verify bottom nav bar is visible across all 4 tabs
    const bottomNav = page.locator('nav, [role="tablist"], [data-testid="bottom-nav"]').first();
    for (const tab of [
      UI_LABELS.tabs.schedule,
      UI_LABELS.tabs.marks,
      UI_LABELS.tabs.notes,
      UI_LABELS.tabs.profile,
    ]) {
      await openTab(page, tab);
      await expect(bottomNav).toBeVisible({ timeout: 3000 });
    }
  });

  test('T3-P16 (F6 x F22): Toggling Offline Mode ON in Customization keeps Schedule refresh and Marks on mock data with zero /api/v1/* calls', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-16T10:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const offlineSwitch = page
      .getByRole('switch', { name: /офлайн|offline/i })
      .or(page.getByLabel(/офлайн|offline/i))
      .or(page.getByText(/Офлайн/i))
      .first();
    await offlineSwitch.scrollIntoViewIfNeeded().catch(() => {});
    await expect(offlineSwitch).toBeVisible({ timeout: 5000 });
    await offlineSwitch.click();

    api?.clearRequests();

    // Navigate to Schedule and trigger pull-to-refresh
    await openTab(page, UI_LABELS.tabs.schedule);
    await page.mouse.move(195, 180);
    await page.mouse.down();
    await page.mouse.move(195, 380, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    // Navigate to Marks
    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(/ОАиП|АиСД|Оценки/i).first()).toBeVisible({ timeout: 5000 });

    const apiCalls = api?.getRequestsMatching('/api/v1/') ?? [];
    expect(apiCalls).toHaveLength(0);
  });
});
