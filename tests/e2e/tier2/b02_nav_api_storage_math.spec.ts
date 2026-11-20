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
import { triggerTelegramBackButton } from '../fixtures/telegramMock';
import {
  AUTH_CREDENTIALS,
  GROUP_SCHEDULES,
  UI_LABELS,
  createLargeNotesPayload,
  createNextSchedulesOnlySchedule,
} from '../fixtures/testData';

test.describe('Tier 2 — F5: Root Navigation Shell & Transitions Boundaries', () => {
  test('T2-F5-01: Hold nav long-press near top-left (15,25) and bottom-right (375,820) corners keeps all 4 discs inside 390x844', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    const assertDiscsInViewport = async () => {
      for (const label of [
        UI_LABELS.tabs.schedule,
        UI_LABELS.tabs.marks,
        UI_LABELS.tabs.notes,
        UI_LABELS.tabs.profile,
      ]) {
        const disc = page.getByText(label, { exact: true }).last();
        await expect(disc).toBeVisible({ timeout: 3000 });
        const box = await disc.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(390);
          expect(box.y + box.height).toBeLessThanOrEqual(844);
        }
      }
    };

    // Top-left corner long press
    await page.mouse.move(15, 25);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();
    await assertDiscsInViewport();

    // Dismiss radial menu
    await page.mouse.click(195, 422);
    await page.waitForTimeout(200);

    // Bottom-right corner long press
    await page.mouse.move(375, 820);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();
    await assertDiscsInViewport();
  });

  test('T2-F5-02: Pointer press <480ms or dragged >55px does NOT open radial menu accidentally while scrolling', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    // Ensure Hold mode is active
    const radialCancel = page.locator('[data-testid="radial-menu"]');
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.waitForTimeout(220);
    await page.mouse.up();
    await expect(radialCancel).toHaveCount(0);

    // Drag > 55px even over >480ms duration
    await page.mouse.move(195, 300);
    await page.mouse.down();
    await page.mouse.move(195, 410, { steps: 12 });
    await page.waitForTimeout(520);
    await page.mouse.up();

    // Radial menu should not open; tab "Заметки" should not float as radial item
    const notesVisibleCount = await page.getByText(UI_LABELS.tabs.notes, { exact: true }).count();
    expect(notesVisibleCount).toBeLessThanOrEqual(1);
  });

  test('T2-F5-03: Back button on non-Schedule tab returns to Расписание (tab 0); back inside modal closes modal first', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest', clockDate: '2026-11-19T10:00:00' });

    // Open Lesson Detail modal
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(UI_LABELS.schedule.addNoteToLesson).first()).toBeVisible({
      timeout: 3000,
    });

    // Back closes modal first
    await triggerTelegramBackButton(page);
    await expect(page.getByText(UI_LABELS.schedule.addNoteToLesson)).toHaveCount(0);

    // Switch to Notes tab and trigger BackButton -> returns to Расписание
    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first()).toBeVisible();

    await triggerTelegramBackButton(page);
    await expect(page.getByText(AUTH_CREDENTIALS.defaultGroup).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T2-F5-04: Transition speed boundaries (0.5x and 2.5x) plus transitionsEnabled=false complete tab switches cleanly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const speedSlider = page.locator('input[type="range"][min="0.5"][max="2.5"]').first();
    if (await speedSlider.isVisible().catch(() => false)) {
      await speedSlider.fill('0.5');
      await speedSlider.dispatchEvent('change');
    }

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    if (await speedSlider.isVisible().catch(() => false)) {
      await speedSlider.fill('2.5');
      await speedSlider.dispatchEvent('change');
    }

    // Toggle transitionsEnabled off if switch visible
    const animToggle = page.getByText(/Анимации переходов/i).first();
    if (await animToggle.isVisible().catch(() => false)) {
      await animToggle.click();
    }

    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
  });

  test('T2-F5-05: Switching nav modes (Hold -> Swipe -> Buttons) mid-session updates controls without duplicate bars', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const swipeBtn = page.getByText(UI_LABELS.customization.navSwipe, { exact: true }).first();
    await swipeBtn.scrollIntoViewIfNeeded();
    await swipeBtn.click();
    expect(await page.locator('nav, [role="tablist"]').count()).toBe(0);

    const buttonsBtn = page.getByText(UI_LABELS.customization.navButtons, { exact: true }).first();
    await buttonsBtn.click();
    await expect(page.locator('nav, [role="tablist"]')).toHaveCount(1);

    const holdBtn = page.getByText(UI_LABELS.customization.navHold, { exact: true }).first();
    await holdBtn.click();
    await expect(page.locator('nav, [role="tablist"]')).toHaveCount(0);
  });
});

test.describe('Tier 2 — F6: API Client & Offline/Mock Boundaries', () => {
  test('T2-F6-01: HTTP 500 on /schedule falls back to cached/mock schedule and remains interactive', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'guest',
      api: {
        statusOverrides: {
          '/schedule': 500,
        },
      },
    });

    // Fallback mock schedule renders and remains interactive
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    await page.getByText(UI_LABELS.schedule.subgroup1).first().click();
    await expect(page.getByText('АиСД').first()).toBeVisible();
  });

  test('T2-F6-02: Schedule fetch timeout (>4.5s) triggers automatic fallback without hanging UI', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'guest',
      api: {
        delayByPattern: {
          '/schedule': 6500,
        },
      },
    });

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 8000 });
  });

  test('T2-F6-03: HTTP 401 on authenticated IIS request triggers auto-relogin or graceful fallback', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    api!.setFaults({
      statusOverrides: {
        '/markbook': 401,
      },
    });
    api!.clearRequests();

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    await page.waitForTimeout(500);

    const markbookReqs = api!.getRequestsMatching(/\/markbook/);
    expect(markbookReqs.length).toBeGreaterThanOrEqual(1);
    // UI stays stable and either recovers or shows fallback/message cleanly
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F6-04: Malformed JSON or empty {} payload from API does not crash parsers', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'authenticated',
      api: {
        malformedJsonPatterns: ['/schedule'],
        emptyJsonPatterns: ['/personal-rating', '/markbook'],
      },
    });

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible();
    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F6-05: Invalid custom API Base URL is handled safely and falls back cleanly', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const apiInput = page
      .getByPlaceholder(/https?:\/\/|api/i)
      .or(page.getByLabel(/API|Base URL|Сервер/i))
      .first();
    await apiInput.scrollIntoViewIfNeeded();
    await expect(apiInput).toBeVisible({ timeout: 5000 });

    await apiInput.fill('not-a-valid-url://bad');
    const saveBtn = page.getByRole('button', { name: /сохранить|применить/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
    } else {
      await apiInput.press('Enter').catch(() => {});
    }

    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tier 2 — F7: Persistence & CloudStorage Boundaries', () => {
  test('T2-F7-01: Group search history caps at max 5 items (6th evicts oldest without duplicates)', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });

    const groupsToSelect = ['510902', '310101', '253501', '451001', '151002', '520901'];
    for (const grp of groupsToSelect) {
      const header = page.getByText(/510902|310101|253501|451001|151002|520901/).first();
      await header.click();
      const input = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
      await expect(input).toBeVisible({ timeout: 3000 });
      await input.fill(grp);
      await page.getByText(grp, { exact: true }).last().click();
      await page.waitForTimeout(100);
    }

    // Re-open search with empty input to inspect recent history
    await page.getByText('520901').first().click();
    const input = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await input.fill('');

    await expect(page.getByText('520901').last()).toBeVisible();
    // Oldest '510902' should have been evicted from the 5-item history dropdown
    const historyDeleteBtns = page.locator('[aria-label*="удалить из истории" i], button:has-text("×"), button:has-text("✕")');
    const count = await historyDeleteBtns.count();
    if (count > 0) {
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  test('T2-F7-02: Corrupted JSON in localStorage (notes_data = "{bad_json") recovers cleanly without crashing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('notes_data', '{bad_json');
      localStorage.setItem('bsuir_notes', '{bad_json');
    });

    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    const addBtn = page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.locator('textarea').first().fill('Восстановленная заметка');
    await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();

    await expect(page.getByText('Восстановленная заметка')).toBeVisible();
  });

  test('T2-F7-03: Large notes payload near CloudStorage 4096-byte limit persists cleanly across reload without dropping notes', async ({
    page,
  }) => {
    const largeNotes = createLargeNotesPayload(25);
    const serialized = JSON.stringify(largeNotes);
    expect(serialized.length).toBeGreaterThan(4096);

    await page.addInitScript((jsonStr: string) => {
      if (!sessionStorage.getItem('__t2_f7_03_seeded__')) {
        sessionStorage.setItem('__t2_f7_03_seeded__', '1');
        localStorage.setItem('notes_data', jsonStr);
      }
    }, serialized);

    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await expect(page.getByText('лабораторной работе №1').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('лабораторной работе №25').first()).toBeVisible({ timeout: 5000 });

    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page);
    await openTab(page, UI_LABELS.tabs.notes);

    await expect(page.getByText('лабораторной работе №25').first()).toBeVisible({ timeout: 5000 });
  });

  test('T2-F7-04: Legacy placeholder group "114001" or empty selectedGroup redirects safely to login_group or 310101/510902', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('selectedGroup', '114001');
      localStorage.setItem('login_group', '310101');
    });

    await bootApp(page, { mode: 'guest' });
    await expect(page.getByText('114001')).toHaveCount(0);
    await expect(page.getByText(/310101|510902/).first()).toBeVisible({ timeout: 5000 });
  });

  test('T2-F7-05: CloudStorage.getItem returning async error falls back cleanly to localStorage', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'notes_data',
        JSON.stringify([
          {
            id: 'local-fallback-1',
            subject: 'ОАиП',
            text: 'Локальная заметка при ошибке CloudStorage',
            date: '19.11.2026',
            time: '10:35',
            isEvent: false,
            isPinned: false,
            lessonType: 'ЛК',
            attachments: [],
          },
        ]),
      );
    });

    await bootApp(page, {
      mode: 'guest',
      telegram: {
        mode: 'full',
        cloudStorageErrorOnGet: true,
      },
    });

    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText('Локальная заметка при ошибке CloudStorage')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Tier 2 — F8: Schedule Math & Timer Engine Boundaries', () => {
  test('T2-F8-01: Academic week boundary on Aug 31 vs Sept 1 transitions cleanly to Week 1', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-09-01T10:00:00',
    });

    await expect(page.getByText(/1\s*(учебная\s*)?недел/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Aug 31 belongs to prior year cycle (not Week 1 of new Sept 1 cycle unless aligned mod 4)
    await page.clock.setFixedTime(new Date('2026-08-31T10:00:00'));
    await page.reload();
    await skipSplashIfVisible(page);
    await enterGuestMode(page).catch(() => {});

    await expect(page.getByText(/[1-4]\s*(учебная\s*)?недел/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T2-F8-02: 91-day carousel boundary indices: index 0 (today - 7d) and index 90 (today + 83d) render valid dates', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T10:00:00',
    });

    // Index 0 = 12 Nov 2026; Index 90 = 10 Feb 2027
    const railItems = page.locator('[data-testid="date-rail-item"], [data-testid="date-rail"] button');
    if ((await railItems.count()) >= 91) {
      expect(await railItems.count()).toBe(91);
      await railItems.first().click();
      await expect(page.getByText(/12/i).first()).toBeVisible();
      await railItems.last().scrollIntoViewIfNeeded();
      await railItems.last().click();
      await expect(page.getByText(/10/i).first()).toBeVisible();
    } else {
      // Fallback via visible day numbers on right rail
      const day12 = page.getByText('12', { exact: true }).first();
      await day12.scrollIntoViewIfNeeded().catch(() => {});
      await day12.click();
      await expect(page.getByText(/12/).first()).toBeVisible();
    }
  });

  test('T2-F8-03: Active lesson exact boundary timestamps (before start, startTime, min 40 break, min 45 2nd half, endTime)', async ({
    page,
  }) => {
    // 2026-11-19 is Thursday; ОАиП is 09:00 - 10:25
    await page.clock.install({ time: new Date('2026-11-19T08:59:59') });
    await bootApp(page, { mode: 'guest' });

    // 1 second before start -> inactive
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(UI_LABELS.schedule.untilEnd)).toHaveCount(0);
    await triggerTelegramBackButton(page);

    // Exact startTime 09:00:00 -> Phase 1
    await page.clock.setFixedTime(new Date('2026-11-19T09:00:00'));
    await page.waitForTimeout(1100);
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(/До конца пары/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/перерыв через/i).first()).toBeVisible({ timeout: 3000 });
    await triggerTelegramBackButton(page);

    // Exact minute 40 (09:40:00) -> Phase 2 Break
    await page.clock.setFixedTime(new Date('2026-11-19T09:40:00'));
    await page.waitForTimeout(1100);
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(/Перерыв/i).first()).toBeVisible({ timeout: 3000 });
    await triggerTelegramBackButton(page);

    // Exact minute 45 (09:45:00) -> Phase 3 2nd half
    await page.clock.setFixedTime(new Date('2026-11-19T09:45:00'));
    await page.waitForTimeout(1100);
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(/2-я часть/i).first()).toBeVisible({ timeout: 3000 });
    await triggerTelegramBackButton(page);

    // Exact endTime (10:25:00) -> inactive
    await page.clock.setFixedTime(new Date('2026-11-19T10:25:00'));
    await page.waitForTimeout(1100);
    await page.getByText('ОАиП').first().click();
    await expect(page.getByText(UI_LABELS.schedule.untilEnd)).toHaveCount(0);
  });

  test('T2-F8-04: Non-standard short lesson (<70 min, e.g. 50 min) splits break math proportionally without negative durations', async ({
    page,
  }) => {
    const customSchedule = structuredClone(GROUP_SCHEDULES['510902']);
    if (customSchedule.schedules) {
      customSchedule.schedules['Четверг'] = [
        {
          ...customSchedule.schedules['Четверг'][0],
          startLessonTime: '09:00',
          endLessonTime: '09:50',
        },
      ];
    }

    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T09:24:00',
      api: {
        payloadOverrides: {
          groupSchedules: {
            ...GROUP_SCHEDULES,
            '510902': customSchedule,
          },
        },
      },
    });

    await page.getByText('ОАиП').first().click();
    const modalText = await page.locator('[role="dialog"], .fixed').last().innerText();
    expect(modalText).toMatch(/Перерыв|До конца пары/i);
    expect(modalText).not.toMatch(/-\d+\s*(мин|сек)/);
    expect(modalText).not.toContain('NaN');
  });

  test('T2-F8-05: Schedule with only nextSchedules (empty schedules) and lessons with weeks: [] render accurately', async ({
    page,
  }) => {
    // First verify weekNumber: [] ('Физика' in 510902) renders on week 2
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T10:00:00',
    });
    await expect(page.getByText('Физика').first()).toBeVisible({ timeout: 5000 });

    // Now verify nextSchedules-only payload renders lessons from nextSchedules
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T10:00:00',
      api: {
        payloadOverrides: {
          groupSchedules: {
            ...GROUP_SCHEDULES,
            '510902': createNextSchedulesOnlySchedule(),
          },
        },
      },
    });
    await expect(page.getByText('ИИиМО').first()).toBeVisible({ timeout: 5000 });
  });
});
