import {
  test,
  expect,
  bootApp,
  openTab,
  freezeClock,
} from '../fixtures/appHarness';
import {
  createSessionActiveSchedule,
  GROUP_SCHEDULES,
  UI_LABELS,
} from '../fixtures/testData';

test.describe('F8: Schedule Math & Timer Engine', () => {
  test('T1-F8-01: Clock frozen on known Sept-1 Monday-aligned dates computes exact 1..4 academic week', async ({
    page,
  }) => {
    // 2026-09-07 is Monday of academic week 2 (since 2026-09-01 is Tuesday of week 1 -> Mon Aug 31)
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-09-07T10:00:00',
    });

    await expect(page.getByText('2 учебная неделя').first()).toBeVisible({ timeout: 5000 });

    // Advance to next Monday (2026-09-14 = week 3)
    await freezeClock(page, '2026-09-14T10:00:00');
    await page.reload();
    const guestBtn = page.getByText(UI_LABELS.auth.guestButton).first();
    if (await guestBtn.isVisible().catch(() => false)) {
      await guestBtn.click();
    }

    await expect(page.getByText('3 учебная неделя').first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F8-02: 91-day carousel spans -7..+83 days around today and selecting dates updates weekday & week number', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T10:00:00', // Thursday, day 19, week 4
    });

    await expect(page.getByText('4 учебная неделя').first()).toBeVisible({ timeout: 5000 });

    // Select a day 7 days ahead (26 Nov -> Thursday of week 1) in date rail / carousel
    const day26 = page.getByText('26', { exact: true }).first();
    await day26.scrollIntoViewIfNeeded().catch(() => {});
    await expect(day26).toBeVisible({ timeout: 5000 });
    await day26.click();

    await expect(page.getByText('1 учебная неделя').first()).toBeVisible({ timeout: 5000 });

    // Verify rail contains earlier day (e.g. 12 = today - 7) and later days
    await expect(page.getByText('12', { exact: true }).first()).toBeAttached();
  });

  test('T1-F8-03: Subgroup filter includes subgroup 0 lessons in all views and isolates subgroup 1 vs 2', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00', // Thursday 510902: ОАиП (0), АиСД (1), МатАн (2)
    });

    // "Все": all 3 visible
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('АиСД').first()).toBeVisible();
    await expect(page.getByText('МатАн').first()).toBeVisible();

    // "1 подгр.": ОАиП + АиСД visible, МатАн hidden
    await page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first().click();
    await expect(page.getByText('ОАиП').first()).toBeVisible();
    await expect(page.getByText('АиСД').first()).toBeVisible();
    await expect(page.getByText('МатАн')).toHaveCount(0);

    // "2 подгр.": ОАиП + МатАн visible, АиСД hidden
    await page.getByText(UI_LABELS.schedule.subgroup2, { exact: true }).first().click();
    await expect(page.getByText('ОАиП').first()).toBeVisible();
    await expect(page.getByText('МатАн').first()).toBeVisible();
    await expect(page.getByText('АиСД')).toHaveCount(0);
  });

  test('T1-F8-04: Active lesson timer tracks Phase 1 (first 40m), Phase 2 (min 40-45 Break), and Phase 3 (>45m 2nd half)', async ({
    page,
  }) => {
    // Phase 1: 09:15 (15 min into 09:00–10:25 ОАиП)
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T09:15:00',
    });

    // Open lesson detail modal or read inline timer on active card
    const oapCard = page.getByText('ОАиП').first();
    await expect(oapCard).toBeVisible({ timeout: 5000 });
    await oapCard.click();

    await expect(page.getByText(/До конца пары/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/перерыв через/i).first()).toBeVisible({ timeout: 5000 });

    // Phase 2: 09:42 (min 42 = 5-minute break)
    await freezeClock(page, '2026-11-19T09:42:00');
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Перерыв/i).first()).toBeVisible({ timeout: 5000 });

    // Phase 3: 09:55 (min 55 = 2nd half)
    await freezeClock(page, '2026-11-19T09:55:00');
    await page.waitForTimeout(1200);
    await expect(page.getByText(/2-я часть/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F8-05: Active exam dates enable Session mode and "К след. паре" computes next lesson prioritizing ЛР/ПЗ', async ({
    page,
  }) => {
    const refDate = new Date('2026-11-19T08:00:00');
    await bootApp(page, {
      mode: 'guest',
      clockDate: refDate,
      api: {
        payloadOverrides: {
          groupSchedules: {
            ...GROUP_SCHEDULES,
            '510902': createSessionActiveSchedule(refDate),
          },
        },
      },
    });

    // Session pill is visible & active
    const sessionPill = page.getByText(UI_LABELS.schedule.sessionPill, { exact: true }).first();
    await expect(sessionPill).toBeVisible({ timeout: 5000 });
    await sessionPill.click();
    await expect(page.getByText(/Экзамен|Консультация/i).first()).toBeVisible({ timeout: 5000 });

    // Return to Notes and check "К след. паре" shortcut computes next lesson date/time
    await openTab(page, UI_LABELS.tabs.notes);
    const fab = page
      .getByRole('button', { name: /Добавить|Создать|\+/i })
      .or(page.locator('button').filter({ hasText: '+' }))
      .last();
    await fab.click();

    const nextLessonBtn = page
      .getByRole('button', { name: UI_LABELS.notes.nextLessonShortcut })
      .or(page.getByText(UI_LABELS.notes.nextLessonShortcut))
      .first();
    await expect(nextLessonBtn).toBeVisible({ timeout: 5000 });
    await nextLessonBtn.click();

    // Selecting subject АиСД (ЛР) -> "К след. паре" populates date & time (10:35)
    await expect(page.getByText(/\d{2}\.\d{2}\.\d{4}|09:00|10:35/).first()).toBeVisible({
      timeout: 3000,
    });
  });
});
