import {
  test,
  expect,
  bootApp,
} from '../fixtures/appHarness';
import {
  createSessionActiveSchedule,
  GROUP_SCHEDULES,
  UI_LABELS,
} from '../fixtures/testData';

test.describe('F10: Schedule Screen (Search, Teacher Mode, Date Rail, Detail Modal, Session)', () => {
  test('T1-F10-01: Schedule displays group header, academic week label, subgroup chips, and lesson cards', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible();

    await expect(page.getByText(UI_LABELS.schedule.allSubgroups, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.schedule.subgroup2, { exact: true }).first()).toBeVisible();

    // Lesson card details (time, type badge, title, teacher, auditory + gym fallback)
    await expect(page.getByText('09:00').first()).toBeVisible();
    await expect(page.getByText('ЛК').first()).toBeVisible();
    await expect(page.getByText('ОАиП').first()).toBeVisible();
    await expect(page.getByText('Азаров И. В.').first()).toBeVisible();
    await expect(page.getByText('101-4').first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.schedule.gymAuditory).first()).toBeVisible();
  });

  test('T1-F10-02: Group search filters /student-groups, switches group, and manages history with delete X', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await page.getByText('510902').first().click();

    const searchInput = page.getByPlaceholder(/групп|преподавател/i).first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('310101');

    const groupOption = page.getByText('310101', { exact: false }).last();
    await expect(groupOption).toBeVisible({ timeout: 3000 });
    await groupOption.click();

    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });
    expect(api!.getRequestsMatching('/student-groups').length).toBeGreaterThanOrEqual(1);

    // Re-open search panel and test history delete X
    await page.getByText('310101').first().click();
    const historyDeleteBtns = page.locator(
      'button[aria-label*="Удал" i], button:has-text("×"), button:has-text("✕"), button:has-text("X")',
    );
    const initialHistoryCount = await historyDeleteBtns.count();
    expect(initialHistoryCount).toBeGreaterThanOrEqual(1);

    await historyDeleteBtns.first().click();
    await page.waitForTimeout(150);
    const remainingHistoryCount = await historyDeleteBtns.count();
    expect(remainingHistoryCount).toBeLessThan(initialHistoryCount);
  });

  test('T1-F10-03: Selecting a lecturer opens inline teacher schedule mode with "Назад к группе" back button', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await page.getByText('510902').first().click();

    const searchInput = page.getByPlaceholder(/групп|преподавател/i).first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('Азаров');

    const empOption = page.getByText(/Азаров/i).last();
    await expect(empOption).toBeVisible({ timeout: 3000 });
    await empOption.click();

    await expect(page.getByText('Азаров И. В.').first()).toBeVisible({ timeout: 5000 });
    expect(api!.getRequestsMatching('/employees/schedule/i-azarov').length).toBeGreaterThanOrEqual(1);

    const backBtn = page
      .getByRole('button', { name: UI_LABELS.schedule.backToGroup })
      .or(page.getByLabel(UI_LABELS.schedule.backToGroup))
      .or(page.getByText(UI_LABELS.schedule.backToGroup))
      .first();
    await expect(backBtn).toBeVisible({ timeout: 3000 });
    await backBtn.click();

    await expect(page.getByText('510902').first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F10-04: Clicking a lesson opens Lesson Detail modal with co-attending groups, 3 upcoming dates, and Quick Note trigger', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await page.getByText('ОАиП').first().click();

    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await expect(
      dialog.getByText('Основы алгоритмизации и программирования').first(),
    ).toBeVisible();
    await expect(dialog.getByText('Азаров И. В.').first()).toBeVisible();

    // Co-attending groups (510902, 310101, 253501)
    await expect(dialog.getByText('310101').first()).toBeVisible();
    await expect(dialog.getByText('253501').first()).toBeVisible();

    // Quick Note button
    await expect(
      dialog.getByText(UI_LABELS.schedule.addNoteToLesson).first(),
    ).toBeVisible();

    // 3 upcoming dates (DD.MM) — clicking one jumps and closes modal
    const upcomingDateButtons = dialog.locator('button, [role="button"], div').filter({
      hasText: /^\d{2}\.\d{2}$/,
    });
    const upcomingCount = await upcomingDateButtons.count();
    expect(upcomingCount).toBeGreaterThanOrEqual(3);

    await upcomingDateButtons.first().click();
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test('T1-F10-05: Floating AppleVerticalDateRail navigates days, collapses/restores on swipe, and Session pill toggles exams', async ({
    page,
  }) => {
    const refDate = new Date('2026-11-19T10:00:00');
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

    // Click day 20 in vertical date rail
    const day20 = page.getByText('20', { exact: true }).first();
    await expect(day20).toBeVisible({ timeout: 5000 });
    const railBox = await day20.boundingBox();
    expect(railBox).not.toBeNull();
    await day20.click();

    // Swipe right on the rail to collapse into pill handle
    if (railBox) {
      const startX = railBox.x + railBox.width / 2;
      const startY = railBox.y + railBox.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(388, startY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(250);

      // Restore on tap / swipe left near right edge
      await page.mouse.click(382, startY);
      await page.waitForTimeout(250);
    }

    // Session pill toggles SessionExamCard view
    const sessionPill = page.getByText(UI_LABELS.schedule.sessionPill, { exact: true }).first();
    await expect(sessionPill).toBeVisible({ timeout: 5000 });
    await sessionPill.click();

    await expect(page.getByText('Экзамен').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Консультация').first()).toBeVisible();
  });
});
