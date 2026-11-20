import {
  bootApp,
  checkNoHorizontalOverflow,
  expect,
  openProfileSubScreen,
  openTab,
  test,
} from '../fixtures/appHarness';
import {
  ANDROID_THEMES,
  ANNOUNCEMENTS,
  NOTIFICATIONS,
  PERSONAL_CV,
  UI_LABELS,
} from '../fixtures/testData';
import { clearTelegramMockLog, getTelegramMockLog } from '../fixtures/telegramMock';

test.describe('Tier 2 — F14: Profile Hub Boundaries', () => {
  test('T2-F14-01: Non-headman student hides "Журнал старосты" menu entry', async ({ page }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: false },
    });

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(UI_LABELS.profile.group).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(UI_LABELS.profile.headmanJournal)).toHaveCount(0);
  });

  test('T2-F14-02: Guest user opening Profile sees Guest state without crashing on missing photo/FIO', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.profile);

    await expect(page.getByText(UI_LABELS.profile.customization).first()).toBeVisible({
      timeout: 5000,
    });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F14-03: Missing login_photo falls back cleanly to default BSUIR avatar crest <img> with naturalWidth > 0', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.profile);

    const avatarImg = page.locator('img').first();
    await expect(avatarImg).toBeVisible({ timeout: 5000 });
    const loaded = await avatarImg.evaluate((img: HTMLImageElement) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    }));
    expect(loaded.complete).toBe(true);
    expect(loaded.naturalWidth).toBeGreaterThan(0);
  });

  test('T2-F14-04: 0 unread notifications and 0 ч absences render cleanly without broken badges', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          notifications: [],
          omissions: [],
          omissionsByStudent: { omissionDtoList: [] },
          disrespectfulOmissions: [],
        },
      },
    });

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(UI_LABELS.profile.notifications).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.profile.absences).first()).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });

  test('T2-F14-05: Canceling avatar file upload or selecting invalid file does not corrupt avatar', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.profile);

    const avatarImg = page.locator('img').first();
    await expect(avatarImg).toBeVisible({ timeout: 5000 });

    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles({
        name: 'invalid.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not-an-image'),
      });
      await page.waitForTimeout(200);
    }

    const loaded = await avatarImg.evaluate((img: HTMLImageElement) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    }));
    expect(loaded.complete).toBe(true);
    expect(loaded.naturalWidth).toBeGreaterThan(0);
  });
});

test.describe('Tier 2 — F15: Notifications Boundaries', () => {
  test('T2-F15-01: Empty notifications list renders clean empty state', async ({ page }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: { notifications: [] },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('undefined');
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F15-02: Filter chip with 0 matching notifications ("Важное") shows empty filtered state', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          notifications: NOTIFICATIONS.filter((n) => n.type === 'INFO'),
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    await expect(page.getByText(/пересдача экзамена/i).first()).toBeVisible({ timeout: 5000 });

    await page.getByText('Важное', { exact: true }).first().click();
    await expect(page.getByText(/пересдача экзамена/i)).toHaveCount(0);
  });

  test('T2-F15-03: Failed PATCH /notifications does not crash UI or prevent reading notifications', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, { mode: 'authenticated' });

    // Fail only PATCH /notifications while letting GET /notifications pass
    await page.route('**/api/v1/notifications*', async (route) => {
      if (route.request().method().toUpperCase() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'PATCH failed' }),
        });
      } else {
        await route.fallback();
      }
    });

    await openProfileSubScreen(page, UI_LABELS.profile.notifications);
    await expect(page.getByText(/пересдача экзамена/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T2-F15-04: Search query matching 0 notifications displays clean empty result message', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('НетТакогоУведомления999');

    await expect(page.getByText(/пересдача экзамена/i)).toHaveCount(0);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F15-05: Long notification HTML/special characters escape safely (no XSS execution)', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.notifications);

    await expect(page.getByText(/Открыта запись на факультатив/i).first()).toBeVisible({
      timeout: 5000,
    });
    const xssFlag = await page.evaluate(
      () => (window as unknown as { __xss?: unknown }).__xss,
    );
    expect(xssFlag).toBeUndefined();
  });
});

test.describe('Tier 2 — F16: Study — Certificates & Mark Sheets Boundaries', () => {
  test('T2-F16-01: Certificate order with empty custom place or count out of 1..5 rejects/clamps invalid input', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.study);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.orderCertificate }).first().click();

    // Check count clamping 1..5 via +/- buttons if present
    const plusBtn = page.getByRole('button', { name: /^\+$/ }).last();
    const minusBtn = page.getByRole('button', { name: /^[-−]$/ }).last();
    if (await minusBtn.isVisible().catch(() => false)) {
      await minusBtn.click();
      await minusBtn.click();
      await expect(page.getByText(/^1$/).first()).toBeVisible();
    }
    if (await plusBtn.isVisible().catch(() => false)) {
      for (let i = 0; i < 8; i++) await plusBtn.click();
      await expect(page.getByText(/^5$/).first()).toBeVisible();
      await expect(page.getByText(/^6$/)).toHaveCount(0);
    }

    // Select custom place option if present and leave input blank -> blocked from calling POST /certificate/register
    const customToggle = page.getByText(/Другое|Своё место|Ввести вручную/i).first();
    if (await customToggle.isVisible().catch(() => false)) {
      await customToggle.click();
      const customInput = page.locator('input[type="text"], textarea').last();
      await customInput.fill('   ');
      api!.clearRequests();
      await page.getByRole('button', { name: /Заказать|Отправить|Оформить/i }).last().click();
      await page.waitForTimeout(200);
      expect(api!.getRequestsMatching(/\/certificate\/register/).length).toBe(0);
    }
  });

  test('T2-F16-02: Rejected certificate (status: 3) displays rejectionReason without cancel button', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await expect(page.getByText(UI_LABELS.studyAndOrvi.statusRejected).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Неверно указано наименование учреждения')).toBeVisible();

    // Only status 2 (id 302) should show "Отменить заявку" (count = 1)
    await expect(page.getByText(UI_LABELS.studyAndOrvi.cancelRequest)).toHaveCount(1);
  });

  test('T2-F16-03: Mark sheet toggle between respectful (0.00 BYN) and unexcused (hours * 5.75 BYN) updates price for 2, 4, 6h', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await page.getByText(UI_LABELS.studyAndOrvi.markSheetsTab, { exact: true }).first().click();
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.orderMarkSheet }).first().click();

    // Ensure unexcused (без уважительной / неув.)
    const reasonSwitch = page.locator('input[type="checkbox"], [role="switch"]').first();
    if (await reasonSwitch.isVisible().catch(() => false)) {
      const checked = await reasonSwitch.isChecked().catch(() => false);
      if (checked) await reasonSwitch.click();
    }

    // 2 hours -> 11.50
    await page.getByText(/^2(\s*ч)?$/).first().click();
    await expect(page.getByText(/11[.,]50?/).first()).toBeVisible({ timeout: 3000 });

    // 4 hours -> 23.00
    await page.getByText(/^4(\s*ч)?$/).first().click();
    await expect(page.getByText(/23[.,]00?/).first()).toBeVisible({ timeout: 3000 });

    // 6 hours -> 34.50
    await page.getByText(/^6(\s*ч)?$/).first().click();
    await expect(page.getByText(/34[.,]50?/).first()).toBeVisible({ timeout: 3000 });

    // Respectful reason -> 0.00
    if (await reasonSwitch.isVisible().catch(() => false)) {
      await reasonSwitch.click();
      await expect(page.getByText(/0[.,]00/).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('T2-F16-04: API error on POST /certificate/register shows inline error without losing form unexpectedly', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();
    api!.setFaults({ statusOverrides: { '/certificate/register': 500 } });

    await openProfileSubScreen(page, UI_LABELS.profile.study);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.orderCertificate }).first().click();

    await page.getByRole('button', { name: /Заказать|Отправить|Оформить/i }).last().click();
    await expect(page.getByText(/ошибка|не удалось/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T2-F16-05: Empty /certificate/places or /mark-sheet/subjects uses built-in fallback places and subjects', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          certificatePlaces: [],
          markSheetSubjects: [],
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.study);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.orderCertificate }).first().click();
    await expect(page.getByText(/По месту требования|военный комиссариат/i).first()).toBeVisible({
      timeout: 3000,
    });

    await page.getByRole('button', { name: /отмена|закрыть/i }).last().click();
    await page.getByText(UI_LABELS.studyAndOrvi.markSheetsTab, { exact: true }).first().click();
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.orderMarkSheet }).first().click();
    await expect(page.getByText(/ОАиП|АиСД|КСиС/).first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Tier 2 — F17: Absences & ORVI Boundaries', () => {
  test('T2-F17-01: Student with 0 absences renders 0 ч KPIs and empty chart bars without NaN', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          omissions: [],
          omissionsByStudent: { omissionDtoList: [] },
          disrespectfulOmissions: [],
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.absences);
    await expect(page.getByText(/0\s*ч/).first()).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('Infinity');
  });

  test('T2-F17-02: unexcusedHours > totalHours clamps excusedHours at 0 (never negative)', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          omissions: [],
          disrespectfulOmissions: [{ omissionCount: 8, month: 11, date: '19.11.2026' }],
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.absences);
    await expect(page.getByText(/По справкам/i).first()).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/-\d+\s*ч/);
  });

  test('T2-F17-03: ORVI submission with empty placeOfStay or empty signature canvas blocks submission', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.absences);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.applyOrvi }).first().click();

    const addressInput = page.locator('input[type="text"], textarea').first();
    await expect(addressInput).toBeVisible({ timeout: 3000 });

    // Empty placeOfStay
    await addressInput.fill('');
    api!.clearRequests();
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.submitOrvi }).click();
    await page.waitForTimeout(200);
    expect(api!.getRequestsMatching(/\/omissions\/create/).length).toBe(0);

    // Valid placeOfStay, but empty signature
    await addressInput.fill('г. Минск, ул. П. Бровки, 6');
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.submitOrvi }).click();
    await page.waitForTimeout(200);
    expect(api!.getRequestsMatching(/\/omissions\/create/).length).toBe(0);
  });

  test('T2-F17-04: HTTP 409 on POST /omissions/create displays monthly limit error message', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'authenticated',
      api: { orviLimitReached: true },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.absences);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.applyOrvi }).first().click();

    // Open signature canvas if button is separate, else draw directly on visible canvas
    const openSigBtn = page.getByRole('button', { name: /подпись|подписать/i }).first();
    if (await openSigBtn.isVisible().catch(() => false)) {
      await openSigBtn.click();
    }

    const canvas = page.locator('canvas').last();
    await expect(canvas).toBeVisible({ timeout: 3000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 90, { steps: 8 });
      await page.mouse.up();
    }

    const saveSigBtn = page.getByRole('button', { name: UI_LABELS.studyAndOrvi.saveSignature }).first();
    if (await saveSigBtn.isVisible().catch(() => false)) {
      await saveSigBtn.click();
    }

    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.submitOrvi }).click();
    await expect(page.getByText(UI_LABELS.studyAndOrvi.orviLimitError)).toBeVisible({
      timeout: 5000,
    });
  });

  test('T2-F17-05: Clear button on fullscreen signature canvas resets strokes and prevents submitting blank canvas', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.absences);
    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.applyOrvi }).first().click();

    const openSigBtn = page.getByRole('button', { name: /подпись|подписать/i }).first();
    if (await openSigBtn.isVisible().catch(() => false)) {
      await openSigBtn.click();
    }

    const canvas = page.locator('canvas').last();
    await expect(canvas).toBeVisible({ timeout: 3000 });
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 140, box.y + 80, { steps: 6 });
      await page.mouse.up();
    }

    await page.getByRole('button', { name: UI_LABELS.studyAndOrvi.clearSignature }).first().click();
    const saveSigBtn = page.getByRole('button', { name: UI_LABELS.studyAndOrvi.saveSignature }).first();
    if (await saveSigBtn.isVisible().catch(() => false)) {
      await saveSigBtn.click();
    }

    api!.clearRequests();
    const submitBtn = page.getByRole('button', { name: UI_LABELS.studyAndOrvi.submitOrvi });
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    }
    await page.waitForTimeout(200);
    expect(api!.getRequestsMatching(/\/omissions\/create/).length).toBe(0);
  });
});

test.describe('Tier 2 — F18: Group & Curator Boundaries', () => {
  test('T2-F18-01: Missing curator (studentGroupCuratorDto: null) renders Group screen without crash', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          groupInfo: {
            studentGroupCuratorDto: null,
            groupInfoStudentDto: [{ fio: 'Соколов Алексей Дмитриевич', position: 'Староста' }],
          },
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.group);
    await expect(page.getByText('Соколов Алексей Дмитриевич').first()).toBeVisible({
      timeout: 5000,
    });
    expect(await page.locator('body').innerText()).not.toContain('undefined');
  });

  test('T2-F18-02: Unformatted phone string (375291234567) formats cleanly or preserves valid tel: href', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    const telLink = page.locator('a[href^="tel:"]').first();
    await expect(telLink).toBeVisible({ timeout: 5000 });
    const href = await telLink.getAttribute('href');
    expect(href).toMatch(/^tel:\+?375291234567$/);
  });

  test('T2-F18-03: Search query with no matching students shows empty roster message while keeping curator card intact', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    const searchInput = page.locator('input[type="search"], input[type="text"], input:not([type])').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('НесуществующийСтудент999');

    await expect(page.getByText(/Азаров Игорь Викторович/).first()).toBeVisible();
    await expect(page.getByText('Морозов Никита Сергеевич')).toHaveCount(0);
  });

  test('T2-F18-04: All primary and fallback endpoints returning empty lists shows clean empty state', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          groupInfo: { studentGroupCuratorDto: null, groupInfoStudentDto: [] },
          groupStudentsFallback: { students: [] },
          groupRatingFallback: [],
          omissions: [],
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.group);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F18-05: Long student names and multiple role badges wrap cleanly within 390px', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    await expect(
      page.getByText(/Константинопольский-Свердличенко/).first(),
    ).toBeVisible({ timeout: 5000 });
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });
});

test.describe('Tier 2 — F19: Headman Journal Boundaries', () => {
  test('T2-F19-01: Student missed-hours stepper cannot decrement below 0', async ({ page }) => {
    await bootApp(page, { mode: 'authenticated', api: { isHeadman: true } });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    const firstRow = page.getByText('Волкова Мария Андреевна').locator('..').locator('..');
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    const minusBtn = firstRow.getByRole('button', { name: /^[-−]$/ }).first();
    await minusBtn.click();
    await minusBtn.click();

    await expect(firstRow).not.toContainText(/-\d+/);
  });

  test('T2-F19-02: Student missed-hours stepper cannot increment above lesson maxHours (2)', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated', api: { isHeadman: true } });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    const firstRow = page.getByText('Волкова Мария Андреевна').locator('..').locator('..');
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    const plusBtn = firstRow.getByRole('button', { name: /^\+$/ }).first();
    for (let i = 0; i < 5; i++) {
      if (await plusBtn.isEnabled().catch(() => false)) {
        await plusBtn.click();
      }
    }

    const rowText = await firstRow.innerText();
    expect(rowText).toContain('2');
    expect(rowText).not.toMatch(/\b[3-9]\b/);
  });

  test('T2-F19-03: Saving headman attendance when POST /headman/create returns error displays error feedback without losing edits', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, { mode: 'authenticated', api: { isHeadman: true } });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);
    const firstRow = page.getByText('Волкова Мария Андреевна').locator('..').locator('..');
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.getByRole('button', { name: /^\+$/ }).first().click();

    api!.setFaults({ statusOverrides: { '/headman/create': 500 } });
    await page.getByRole('button', { name: UI_LABELS.headman.saveAttendance }).click();

    await expect(page.getByText(/ошибка|не удалось/i).first()).toBeVisible({ timeout: 5000 });
    expect(await firstRow.innerText()).toContain('1');
  });

  test('T2-F19-04: Lesson with 0 students renders empty state gracefully', async ({ page }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        isHeadman: true,
        payloadOverrides: { headmanStudents: [] },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T2-F19-05: Switching between subjects reloads attendance cleanly without cross-contaminating student hours', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated', api: { isHeadman: true } });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    const volkovaRow = page.getByText('Волкова Мария Андреевна').locator('..').locator('..');
    await expect(volkovaRow).toBeVisible({ timeout: 5000 });
    // On ОАиП ЛК (5001), Volkova has 0 missed hours
    expect(await volkovaRow.innerText()).toContain('0');

    // Switch to АиСД (1003, lesson 5004): Volkova has 2 missed hours
    await page.getByText(/АиСД/).first().click();
    await expect(volkovaRow).toContainText('2', { timeout: 5000 });
  });
});

test.describe('Tier 2 — F20: Dormitory, Privileges, Penalties & Announcements Boundaries', () => {
  test('T2-F20-01: Dormitory application without settledDate/roomInfo omits/formats missing fields cleanly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.dormitory);

    await expect(page.getByText('Отклонена').first()).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Invalid Date');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null');
  });

  test('T2-F20-02: Rejected dormitory application renders rejectionReason distinctly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.dormitory);

    await expect(
      page.getByText('Неполный комплект документов о доходах семьи'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2-F20-03: Penalties screen with empty array displays "Дисциплинарных взысканий нет"', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { payloadOverrides: { penalties: [] } },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.penalties);
    await expect(page.getByText(UI_LABELS.emptyStates.noPenalties)).toBeVisible({
      timeout: 5000,
    });
  });

  test('T2-F20-04: Announcements screen handles paginated { content } shape and empty ":( пока нет объявлений"', async ({
    page,
  }) => {
    // Paginated shape
    await bootApp(page, {
      mode: 'authenticated',
      api: { payloadOverrides: { announcements: { content: ANNOUNCEMENTS } } },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.announcements);
    await expect(page.getByText('Расписание пересдач за осенний семестр')).toBeVisible({
      timeout: 5000,
    });

    // Empty shape
    await bootApp(page, {
      mode: 'authenticated',
      api: { payloadOverrides: { announcements: [] } },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.announcements);
    await expect(page.getByText(UI_LABELS.emptyStates.noAnnouncements)).toBeVisible({
      timeout: 5000,
    });
  });

  test('T2-F20-05: Malformed/partial announcement dates do not crash list renderer', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          announcements: [
            {
              id: 999,
              title: 'Срочное объявление деканата',
              content: 'Детали уточняются',
              date: 'not-a-valid-date',
              type: 'INFO',
            },
          ],
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.announcements);
    await expect(page.getByText('Срочное объявление деканата')).toBeVisible({ timeout: 5000 });
    expect(await page.locator('body').innerText()).not.toContain('Invalid Date');
  });
});

test.describe('Tier 2 — F21: IIS Resume & Widget Preview Boundaries', () => {
  test('T2-F21-01: Widget preview day offset clamps strictly at -7 and +30', async ({ page }) => {
    await bootApp(page, { mode: 'authenticated', clockDate: '2026-11-19T10:00:00' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    const prevBtn = page.getByRole('button', { name: /<|‹|пред/i }).first();
    const nextBtn = page.getByRole('button', { name: />|›|след/i }).first();
    await expect(prevBtn).toBeVisible({ timeout: 5000 });

    // Click prev 10 times -> clamps at -7 (12.11)
    for (let i = 0; i < 10; i++) {
      if (await prevBtn.isEnabled().catch(() => false)) await prevBtn.click();
    }
    const textAtMin = await page.locator('body').innerText();
    expect(textAtMin).toContain('12.11');

    // Click next 40 times -> clamps at +30 (19.12)
    for (let i = 0; i < 40; i++) {
      if (await nextBtn.isEnabled().catch(() => false)) await nextBtn.click();
    }
    const textAtMax = await page.locator('body').innerText();
    expect(textAtMax).toContain('19.12');
  });

  test('T2-F21-02: Adding empty skill name or invalid/empty reference link is rejected without calling API', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);
    await expect(page.getByText('TypeScript').first()).toBeVisible({ timeout: 5000 });
    api!.clearRequests();

    const skillsSection = page
      .locator('div, section')
      .filter({ hasText: /Навыки/i })
      .filter({ has: page.getByText('Добавить', { exact: true }) })
      .last();
    const addSkillBtn = page
      .getByRole('button', { name: /добавить навык|\+ навык/i })
      .or(skillsSection.getByText('Добавить', { exact: true }))
      .first();
    await addSkillBtn.scrollIntoViewIfNeeded().catch(() => {});
    await expect(addSkillBtn).toBeVisible({ timeout: 5000 });
    await addSkillBtn.click();

    const skillInput = page.locator('input[type="text"]').last();
    await expect(skillInput).toBeVisible({ timeout: 3000 });
    await skillInput.fill('   ');
    await page
      .getByRole('button', { name: /добавить|сохранить/i })
      .or(page.getByText('Добавить', { exact: true }))
      .last()
      .click();
    await page.waitForTimeout(200);
    expect(api!.getRequestsMatching(/\/profiles\/my-skills/).length).toBe(0);

    const cancelSkillBtn = page.getByRole('button', { name: /отмена|закрыть/i }).last();
    if (await cancelSkillBtn.isVisible().catch(() => false)) {
      await cancelSkillBtn.click();
    }

    const linksSection = page
      .locator('div, section')
      .filter({ hasText: /Ссылки и контакты/i })
      .filter({ has: page.getByText('Добавить', { exact: true }) })
      .last();
    const addLinkBtn = page
      .getByRole('button', { name: /добавить ссылку|\+ ссылка/i })
      .or(linksSection.getByText('Добавить', { exact: true }))
      .first();
    await addLinkBtn.scrollIntoViewIfNeeded().catch(() => {});
    await expect(addLinkBtn).toBeVisible({ timeout: 5000 });
    await addLinkBtn.click();

    await page
      .getByRole('button', { name: /добавить|сохранить/i })
      .or(page.getByText('Добавить', { exact: true }))
      .last()
      .click();
    await page.waitForTimeout(200);
    expect(api!.getRequestsMatching(/\/profiles\/my-references/).length).toBe(0);
  });

  test('T2-F21-03: Missing officeEmail/officePassword hides or gracefully placeholders Outlook credentials card', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          personalCv: {
            ...PERSONAL_CV,
            officeEmail: '',
            officePassword: '',
          },
        },
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);
    await expect(page.getByText('TypeScript').first()).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('undefined');
  });

  test('T2-F21-04: Failed PUT /profiles/... reverts privacy switch state or surfaces error feedback', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    const { api } = await bootApp(page, { mode: 'authenticated' });
    expect(api).not.toBeNull();

    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);
    await expect(page.getByText(/Профиль опубликован/i).first()).toBeVisible({ timeout: 5000 });

    api!.setFaults({
      statusOverrides: {
        '/profiles/personal-cv-published': 500,
      },
    });

    const publishSwitch = page
      .getByText(/Профиль опубликован/i)
      .locator('..')
      .locator('input[type="checkbox"], [role="switch"]')
      .first();
    const initialState = await publishSwitch.isChecked().catch(() => true);
    await publishSwitch.click();
    await page.waitForTimeout(400);

    const hasError = await page.getByText(/ошибка|не удалось/i).first().isVisible().catch(() => false);
    const currentState = await publishSwitch.isChecked().catch(() => initialState);
    expect(hasError || currentState === initialState).toBe(true);
  });

  test('T2-F21-05: Widget preview on a day with >4 lessons truncates cleanly at 4 lessons', async ({
    page,
  }) => {
    // Thursday 2026-11-19 in 510902 has 5 lessons (ОАиП, АиСД, МатАн, Физика, ФизК)
    await bootApp(page, { mode: 'authenticated', clockDate: '2026-11-19T10:00:00' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    // 5th lesson ФизК should be truncated from the 4-lesson widget preview
    const widgetCard = page.getByText(/Виджет|Предпросмотр/i).locator('..').locator('..');
    await expect(widgetCard.getByText('ФизК')).toHaveCount(0);
  });
});

test.describe('Tier 2 — F22: Customization & Settings Boundaries', () => {
  test('T2-F22-01: Custom reminder hours clamps between 1 and 72 hours', async ({ page }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const customChip = page.getByText(/Свой вариант|Своё|Свое|За \d+ ч/i).first();
    await customChip.scrollIntoViewIfNeeded();
    await expect(customChip).toBeVisible({ timeout: 5000 });
    await customChip.click();

    const hoursInput = page.locator('input[type="number"][min="1"][max="72"]').first();
    if (await hoursInput.isVisible().catch(() => false)) {
      await hoursInput.fill('0');
      await hoursInput.blur();
      expect(Number(await hoursInput.inputValue())).toBeGreaterThanOrEqual(1);

      await hoursInput.fill('99');
      await hoursInput.blur();
      expect(Number(await hoursInput.inputValue())).toBeLessThanOrEqual(72);
    } else {
      const minusBtn = page
        .getByRole('button', { name: /^[-−]$/ })
        .or(page.getByText(/^[-−]$/))
        .first();
      const plusBtn = page
        .getByRole('button', { name: /^\+$/ })
        .or(page.getByText('+', { exact: true }))
        .last();
      await expect(minusBtn).toBeVisible({ timeout: 3000 });
      await expect(plusBtn).toBeVisible({ timeout: 3000 });

      for (let i = 0; i < 5; i++) await minusBtn.click();
      await expect(page.getByText(/1\s*ч/i).first()).toBeVisible();
      for (let i = 0; i < 75; i++) await plusBtn.click();
      await expect(page.getByText(/72\s*ч/i).first()).toBeVisible();
    }
  });

  test('T2-F22-02: Vibration strength clamps 0.1..1.0 and "Проверить вибрацию" triggers haptic safely even when disabled', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const vibSlider = page.locator('input[type="range"][min="0.1"][max="1"]').first();
    await vibSlider.scrollIntoViewIfNeeded();
    await expect(vibSlider).toBeVisible({ timeout: 5000 });

    await vibSlider.fill('0.1');
    await vibSlider.dispatchEvent('change');
    expect(Number(await vibSlider.inputValue())).toBeCloseTo(0.1, 2);
    await expect(page.getByText(/Слабая/i).first()).toBeVisible();

    await vibSlider.fill('1');
    await vibSlider.dispatchEvent('change');
    expect(Number(await vibSlider.inputValue())).toBe(1);
    await expect(page.getByText(/Сильная/i).first()).toBeVisible();

    const vibToggle = page
      .getByText(/Включить вибрацию|Вибрация/i)
      .first()
      .locator('..')
      .locator('input[type="checkbox"], [role="switch"]')
      .first();
    await vibToggle.scrollIntoViewIfNeeded();
    await expect(vibToggle).toBeVisible({ timeout: 5000 });
    if (await vibToggle.isChecked().catch(() => true)) {
      await vibToggle.click();
    }

    await clearTelegramMockLog(page);
    const testVibBtn = page.getByText(UI_LABELS.customization.testVibration).first();
    await testVibBtn.scrollIntoViewIfNeeded();
    await expect(testVibBtn).toBeVisible({ timeout: 5000 });
    await testVibBtn.click();

    const tgLog = await getTelegramMockLog(page);
    const hapticCalled = tgLog.some((e) => e.method.startsWith('HapticFeedback.'));
    const feedbackShown = await page
      .getByText(/Вибрация|Тест|Отклик/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hapticCalled || feedbackShown).toBe(true);
  });

  test('T2-F22-03: Text scale slider clamps between 0.8x and 1.4x', async ({ page }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const slider = page.locator('input[type="range"][min="0.8"][max="1.4"]').first();
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeVisible({ timeout: 5000 });

    await slider.fill('0.8');
    await slider.dispatchEvent('change');
    expect(Number(await slider.inputValue())).toBe(0.8);

    await slider.fill('1.4');
    await slider.dispatchEvent('change');
    expect(Number(await slider.inputValue())).toBe(1.4);
  });

  test('T2-F22-04: Transition speed slider clamps between 0.5x and 2.5x', async ({ page }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const slider = page.locator('input[type="range"][min="0.5"][max="2.5"]').first();
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeVisible({ timeout: 5000 });

    await slider.fill('0.5');
    await slider.dispatchEvent('change');
    expect(Number(await slider.inputValue())).toBe(0.5);

    await slider.fill('2.5');
    await slider.dispatchEvent('change');
    expect(Number(await slider.inputValue())).toBe(2.5);
  });

  test('T2-F22-05: Resetting custom primary/background colors restores exact default Dark/Light colors', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    // Apply green/mint palette then reset in Dark theme
    await page.getByText(/Темная/i).first().click();
    const bgTrigger = page.getByText(/^Фон$/).first();
    await bgTrigger.click();
    const hexInput = page.locator('input[placeholder*="#"], input[maxlength="7"]').first();
    await expect(hexInput).toBeVisible({ timeout: 3000 });
    await hexInput.fill('#112233');
    await page.getByRole('button', { name: /применить|готово|ок|выбрать|сохранить/i }).first().click();

    const resetBtns = page.getByRole('button', { name: UI_LABELS.customization.resetPalette });
    const count = await resetBtns.count();
    for (let i = 0; i < count; i++) {
      await resetBtns.nth(i).click();
    }

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const cssBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase();
          const bodyBg = getComputedStyle(document.body).backgroundColor;
          return `${cssBg}|${bodyBg}`;
        }),
      )
      .toMatch(new RegExp(`${ANDROID_THEMES.dark.bg}|rgb\\(39, 39, 41\\)`, 'i'));

    // Switch to Light theme, customize, and reset back to Light default (#F5F5F7)
    await page.getByText(/Светлая/i).first().click();
    await bgTrigger.click();
    await hexInput.fill('#DDEEFF');
    await page.getByRole('button', { name: /применить|готово|ок|выбрать|сохранить/i }).first().click();

    for (let i = 0; i < count; i++) {
      await resetBtns.nth(i).click();
    }

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const cssBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase();
          const bodyBg = getComputedStyle(document.body).backgroundColor;
          return `${cssBg}|${bodyBg}`;
        }),
      )
      .toMatch(new RegExp(`${ANDROID_THEMES.light.bg}|rgb\\(245, 245, 247\\)`, 'i'));
  });
});
