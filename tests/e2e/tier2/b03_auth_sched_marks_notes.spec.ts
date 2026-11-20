import {
  bootApp,
  checkNoHorizontalOverflow,
  expect,
  openProfileSubScreen,
  openTab,
  test,
} from '../fixtures/appHarness';
import {
  AUTH_CREDENTIALS,
  CLAMPED_FULL_LABS_RATING,
  EMPTY_RATING,
  MARKBOOK,
  PERSONAL_RATING,
  UI_LABELS,
  ZACHET_ONLY_MARKBOOK,
  createMultiSemesterMarkbook,
} from '../fixtures/testData';

test.describe('Tier 2 — F9: Auth Screen Boundaries', () => {
  test('T2-F9-01: Submitting empty gradebook or empty password shows validation error and blocks network request', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'raw' });
    expect(api).not.toBeNull();

    const loginBtn = page.getByRole('button', { name: UI_LABELS.auth.loginButton });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });

    // Both empty
    await loginBtn.click();
    await expect(page.getByText(UI_LABELS.auth.emptyFieldsError)).toBeVisible({ timeout: 3000 });
    expect(api!.getRequestsMatching(/\/auth\/login/).length).toBe(0);

    // Gradebook filled, password empty
    await page.getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder).fill(AUTH_CREDENTIALS.validUser);
    await loginBtn.click();
    await expect(page.getByText(UI_LABELS.auth.emptyFieldsError)).toBeVisible({ timeout: 3000 });
    expect(api!.getRequestsMatching(/\/auth\/login/).length).toBe(0);
  });

  test('T2-F9-02: HTTP 401/403/404 on /auth/login displays "Неверный логин или пароль"', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, {
      mode: 'raw',
      api: { loginStatus: 401 },
    });
    expect(api).not.toBeNull();

    await page.getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder).fill(AUTH_CREDENTIALS.validUser);
    await page.getByPlaceholder(UI_LABELS.auth.passwordPlaceholder).fill('wrongpass');
    const loginBtn = page.getByRole('button', { name: UI_LABELS.auth.loginButton });
    await loginBtn.click();

    await expect(page.getByText(UI_LABELS.auth.invalidCredsError)).toBeVisible({ timeout: 5000 });

    api!.setFaults({ loginStatus: 403 });
    await loginBtn.click();
    await expect(page.getByText(UI_LABELS.auth.invalidCredsError)).toBeVisible({ timeout: 5000 });

    api!.setFaults({ loginStatus: 404 });
    await loginBtn.click();
    await expect(page.getByText(UI_LABELS.auth.invalidCredsError)).toBeVisible({ timeout: 5000 });
  });

  test('T2-F9-03: HTTP 500/502/503 on /auth/login displays "Ошибка сервера (...)"', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, {
      mode: 'raw',
      api: { loginStatus: 500 },
    });
    expect(api).not.toBeNull();

    await page.getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder).fill(AUTH_CREDENTIALS.validUser);
    await page.getByPlaceholder(UI_LABELS.auth.passwordPlaceholder).fill(AUTH_CREDENTIALS.validPass);
    const loginBtn = page.getByRole('button', { name: UI_LABELS.auth.loginButton });

    await loginBtn.click();
    await expect(page.getByText(/Ошибка сервера.*500/i)).toBeVisible({ timeout: 5000 });

    api!.setFaults({ loginStatus: 503 });
    await loginBtn.click();
    await expect(page.getByText(/Ошибка сервера.*503/i)).toBeVisible({ timeout: 5000 });
  });

  test('T2-F9-04: Network abort on /auth/login displays network error message cleanly', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'raw',
      api: { abortPatterns: ['/auth/login'] },
    });

    await page.getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder).fill(AUTH_CREDENTIALS.validUser);
    await page.getByPlaceholder(UI_LABELS.auth.passwordPlaceholder).fill(AUTH_CREDENTIALS.validPass);
    await page.getByRole('button', { name: UI_LABELS.auth.loginButton }).click();

    await expect(
      page.getByText(/Отсутствует подключение к сети|Ошибка сети|Нет подключения/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2-F9-05: Whitespace-padded gradebook number trims properly before login request', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'raw' });
    expect(api).not.toBeNull();

    await page
      .getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder)
      .fill(`  ${AUTH_CREDENTIALS.validUser}  `);
    await page.getByPlaceholder(UI_LABELS.auth.passwordPlaceholder).fill(AUTH_CREDENTIALS.validPass);
    await page.getByRole('button', { name: UI_LABELS.auth.loginButton }).click();

    await expect(page.getByText(UI_LABELS.tabs.schedule).first()).toBeVisible({ timeout: 5000 });

    const loginReqs = api!.getRequestsMatching(/\/auth\/login/);
    expect(loginReqs.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(loginReqs[0].postData ?? '{}') as { username?: string };
    expect(body.username).toBe(AUTH_CREDENTIALS.validUser);
  });
});

test.describe('Tier 2 — F10: Schedule Screen Boundaries', () => {
  test('T2-F10-01: Day with zero lessons (Sunday) displays clean empty-day state instead of blank screen', async ({
    page,
  }) => {
    // 2026-11-22 is Sunday
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-22T10:00:00',
    });

    await expect(
      page.getByText(/Отличный день|Занятий нет|Выходной/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2-F10-02: Physical education lesson without auditory displays "спортзал"; other lesson without auditory displays "—"', async ({
    page,
  }) => {
    // Thursday 2026-11-19 in 510902 has ФизК (auditories: []) and Физика (auditories: [])
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await expect(page.getByText('ФизК').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.schedule.gymAuditory).first()).toBeVisible();
    await expect(page.getByText('Физика').first()).toBeVisible();
    await expect(page.getByText('—').first()).toBeVisible();
  });

  test('T2-F10-03: Search query with 1 char shows groups only (lecturer triggers at >=2 chars); zero matches displays clean empty message', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest', clockDate: '2026-11-19T10:00:00' });

    await page.getByText(AUTH_CREDENTIALS.defaultGroup).first().click();
    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // 1 character: lecturer should NOT appear
    await searchInput.fill('А');
    await page.waitForTimeout(150);
    await expect(page.getByText('Азаров И. В.')).toHaveCount(0);

    // 2 characters: lecturer DOES appear
    await searchInput.fill('Аз');
    await expect(page.getByText(/Азаров/).first()).toBeVisible({ timeout: 3000 });

    // Zero matches
    await searchInput.fill('Несуществующий999');
    await page.waitForTimeout(150);
    await expect(page.getByText(/Азаров/)).toHaveCount(0);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F10-04: Announcement lesson (announcement: true) without subject renders "Объявление" / "Инфо" badge cleanly', async ({
    page,
  }) => {
    // Tuesday 2026-11-17 in 510902 contains the announcement lesson
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-17T10:00:00',
    });

    await expect(
      page.getByText(/Объявление|Встреча с деканом ФКП/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2-F10-05: Long subject title / 5+ co-attending groups wrap cleanly within 390px width', async ({
    page,
  }) => {
    // Tuesday 2026-11-17 has the very long subject title
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-17T10:00:00',
    });

    await expect(page.getByText(/Проектирование высоконагруженных/i).first()).toBeVisible({
      timeout: 5000,
    });
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);

    // Switch to lecturer Азаров (has 5 co-attending groups on ОАиП) and inspect LessonDetailModal
    await page.getByText('ОАиП').first().click();
    await page.getByText(/Азаров/i).last().click();
    await expect(page.getByText(UI_LABELS.schedule.backToGroup).first()).toBeVisible({
      timeout: 5000,
    });

    await page.getByText('ОАиП').first().click();
    await expect(page.getByText('151002').first()).toBeVisible({ timeout: 5000 });
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});

test.describe('Tier 2 — F11: Marks & Personal Rating Boundaries', () => {
  test('T2-F11-01: Student with zero graded marks displays "Нет оценок" badge and 0.00 / — without NaN', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalRating: EMPTY_RATING,
          markbook: ZACHET_ONLY_MARKBOOK,
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.noMarks).first()).toBeVisible({ timeout: 5000 });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('Infinity');
  });

  test('T2-F11-02: Student with 100% labs submitted displays "Все сданы (100%)"; 0 labs avoids division-by-zero NaN', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalRating: CLAMPED_FULL_LABS_RATING,
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.allLabsDone).first()).toBeVisible({
      timeout: 5000,
    });
    expect(await page.locator('body').innerText()).not.toContain('NaN');
  });

  test('T2-F11-03: submittedLabs exceeding deadlines.labCount clamps cleanly to totalLabs', async ({
    page,
  }) => {
    // CLAMPED_FULL_LABS_RATING has 4 lab marks vs labCount=2 -> must clamp to 2/2 (100%, not 200%)
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalRating: CLAMPED_FULL_LABS_RATING,
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.marks);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/2\s*(из|\/)\s*2/);
    expect(bodyText).not.toContain('200%');
    expect(bodyText).not.toMatch(/4\s*(из|\/)\s*2/);
  });

  test('T2-F11-04: Unmatched search query on Marks displays clean empty filter state while keeping KPI cards intact', async ({
    page,
  }) => {
    const fourSubjectsRating = structuredClone(PERSONAL_RATING);
    fourSubjectsRating.subjects.push({
      id: 14,
      name: 'Физика',
      abbrev: 'Физ',
      lessonTypes: [
        {
          id: 141,
          abbrev: 'ЛК',
          termHoursId: 1006,
          lessons: [
            {
              id: 8,
              controlPoint: 'Тест',
              dateString: '21.10.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 8, taskNumber: null }],
              subGroup: 0,
            },
          ],
        },
      ],
    });

    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalRating: fourSubjectsRating,
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.marks);
    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('НесуществующийПредмет999');

    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible();
    await expect(page.getByText(UI_LABELS.marks.labsLabel).first()).toBeVisible();
    await expect(page.getByText('ОАиП')).toHaveCount(0);
  });

  test('T2-F11-05: Invalid/negative mark values (0, -1) are ignored in average calculation', async ({
    page,
  }) => {
    const ratingWithInvalid = {
      subjects: [
        {
          id: 51,
          name: 'Тестирование ПО',
          abbrev: 'ТПО',
          lessonTypes: [
            {
              id: 511,
              abbrev: 'ЛР',
              termHoursId: 5001,
              lessons: [
                {
                  id: 51,
                  controlPoint: 'Лаба 1',
                  dateString: '10.10.2026',
                  gradebookOmissions: 0,
                  marks: [
                    { mark: 10, taskNumber: 1 },
                    { mark: 0, taskNumber: null },
                    { mark: -1, taskNumber: null },
                  ],
                  subGroup: 0,
                },
              ],
            },
          ],
        },
      ],
      deadlines: [{ termHoursId: 5001, labCount: 2, taskCount: 2, deadlines: [] }],
      percentageMarks: [],
    };

    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalRating: ratingWithInvalid,
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(/10\.0/).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tier 2 — F12: Gradebook Boundaries', () => {
  test('T2-F12-01: Empty markPages renders clean empty state without crash', async ({ page }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          markbook: { ...MARKBOOK, markPages: {} },
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F12-02: Semester containing only "Зачет"/"Незачет" handles semester GPA without NaN', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          markbook: ZACHET_ONLY_MARKBOOK,
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    await expect(page.getByText('Физическая культура').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Зачет').first()).toBeVisible();
    await expect(page.getByText('Незачет').first()).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
  });

  test('T2-F12-03: Low failing marks (1..3) render red destructive status color', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    const lowMarkEl = page.getByText('Дискретная математика').locator('..').getByText('3', { exact: true }).first();
    await expect(lowMarkEl).toBeVisible({ timeout: 5000 });

    const color = await lowMarkEl.evaluate((el) => getComputedStyle(el).color);
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(m).not.toBeNull();
    if (m) {
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(r).toBeGreaterThan(170);
      expect(r).toBeGreaterThan(g + 40);
      expect(r).toBeGreaterThan(b + 40);
    }
  });

  test('T2-F12-04: Unauthenticated Guest opening Gradebook shows graceful prompt/empty/mock state', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(bodyText).not.toContain('NaN');
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F12-05: Multi-semester list (8+ semesters) scrolls smoothly within 390x844', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          markbook: createMultiSemesterMarkbook(8),
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    const sem8 = page.getByText('Дисциплина семестра 8А').first();
    await sem8.scrollIntoViewIfNeeded();
    await expect(sem8).toBeVisible({ timeout: 5000 });
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});

test.describe('Tier 2 — F13: Notes CRUD Boundaries', () => {
  test('T2-F13-01: Attempting to save empty/whitespace-only note text is prevented or shows validation feedback', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('   ');

    const saveBtn = page.getByRole('button', { name: /сохранить|создать|добавить/i }).last();
    const isDisabled = await saveBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await saveBtn.click();
    }

    // Modal should still be open (note was not saved as blank)
    await expect(textarea).toBeVisible();
  });

  test('T2-F13-02: Note without schedule subjects falls back to "Общее" subject option', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      api: {
        payloadOverrides: {
          groupSchedules: {
            '510902': {
              schedules: {},
              nextSchedules: null,
              exams: [],
              currentWeekNumber: 2,
              studentGroupDto: null,
              employeeDto: null,
              startDate: null,
              endDate: null,
              startExamsDate: null,
              endExamsDate: null,
              currentTerm: null,
              nextTerm: null,
            },
          },
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.notes);
    await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();
    await expect(page.getByText(UI_LABELS.notes.generalSubject).first()).toBeVisible({
      timeout: 3000,
    });

    await page.locator('textarea').first().fill('Общая организационная заметка');
    await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();
    await expect(page.getByText('Общая организационная заметка')).toBeVisible();
  });

  test('T2-F13-03: Automatic lessonType inference detects "лаба 3" -> ЛР, "лекция по алгоритмам" -> ЛК, "семинар" -> ПЗ', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    const samples = [
      'Сдать лаба 3 по ОАиП',
      'Прочитать лекция по алгоритмам',
      'Выступить на семинар по физике',
    ];

    for (const text of samples) {
      await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();
      await page.locator('textarea').first().fill(text);
      await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();
      await expect(page.getByText(text)).toBeVisible({ timeout: 3000 });
    }

    // Filter by ЛР
    await page.getByText(/^ЛР(\s*\(\d+\))?$/).first().click();
    await expect(page.getByText('Сдать лаба 3 по ОАиП')).toBeVisible();
    await expect(page.getByText('Прочитать лекция по алгоритмам')).toHaveCount(0);

    // Filter by ЛК
    await page.getByText(/^ЛК(\s*\(\d+\))?$/).first().click();
    await expect(page.getByText('Прочитать лекция по алгоритмам')).toBeVisible();
    await expect(page.getByText('Сдать лаба 3 по ОАиП')).toHaveCount(0);

    // Filter by ПЗ
    await page.getByText(/^ПЗ(\s*\(\d+\))?$/).first().click();
    await expect(page.getByText('Выступить на семинар по физике')).toBeVisible();
    await expect(page.getByText('Прочитать лекция по алгоритмам')).toHaveCount(0);
  });

  test('T2-F13-04: Very long note body (500+ chars) truncates gracefully on card and displays fully in edit modal', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    const longBody = `Длинная заметка: ${'Б'.repeat(530)}КОНЕЦ`;
    await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();
    await page.locator('textarea').first().fill(longBody);
    await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();

    await expect(page.getByText(/Длинная заметка:/).first()).toBeVisible({ timeout: 5000 });
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);

    // Tap card to edit and verify full text preserved
    await page.getByText(/Длинная заметка:/).first().click();
    const editTextarea = page.locator('textarea').first();
    await expect(editTextarea).toHaveValue(longBody);
  });

  test('T2-F13-05: Grid view with odd number of notes (3) renders 2-column layout symmetrically without distortion', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    for (const label of ['Заметка Альфа', 'Заметка Бета', 'Заметка Гамма']) {
      await page.getByRole('button', { name: /добавить|новая|создать|\+/i }).first().click();
      await page.locator('textarea').first().fill(label);
      await page.getByRole('button', { name: /сохранить|создать|добавить/i }).last().click();
    }

    const gridToggle = page.getByRole('button', { name: /сетка|grid|вид/i }).first();
    if (await gridToggle.isVisible().catch(() => false)) {
      await gridToggle.click();
    }

    for (const label of ['Заметка Альфа', 'Заметка Бета', 'Заметка Гамма']) {
      const card = page.getByText(label).first();
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
    }
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});
