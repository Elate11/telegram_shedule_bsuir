import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F19: Headman Journal (Tier 1)', () => {
  test('T1-F19-01: Headman Journal renders subject chips from /headman/subjects and switches active subject', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText('ОАиП (ЛК)').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ОАиП (ЛР)').first()).toBeVisible();
    await expect(page.getByText('АиСД (ЛР)').first()).toBeVisible();

    await page.getByText('АиСД (ЛР)').first().click();

    await expect
      .poll(() =>
        (api?.getRequestsMatching('/headman/data') ?? []).some((r) =>
          r.url.includes('termHoursId=1003'),
        ),
      )
      .toBe(true);

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F19-02: Selecting a subject loads lesson date and subgroup chips from /headman/data', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText('12.11.2026').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('19.11.2026').first()).toBeVisible();

    await page.getByText('ОАиП (ЛР)').first().click();
    await expect(page.getByText(/14\.11\.2026.*п\/г\s*1/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T1-F19-03: Student rows render missed hours and allow + / − stepping within 0..maxHours', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({
      timeout: 5000,
    });

    // Select lesson 12.11.2026 (where Громов has 2 ч and Волкова has 0 ч)
    await page.getByText('12.11.2026').first().click();

    const volkovaRow = page
      .locator('div, li, section')
      .filter({ hasText: 'Волкова Мария Андреевна' })
      .filter({ has: page.getByText('+', { exact: true }) })
      .last();

    await expect(volkovaRow.getByText('0 ч', { exact: true })).toBeVisible();

    const plusBtn = volkovaRow.getByText('+', { exact: true }).first();
    const minusBtn = volkovaRow.getByText('−', { exact: true }).first();

    // Increment twice -> 2 ч, third click clamps at maxHours=2
    await plusBtn.click();
    await expect(volkovaRow.getByText('1 ч', { exact: true })).toBeVisible();
    await plusBtn.click();
    await expect(volkovaRow.getByText('2 ч', { exact: true })).toBeVisible();
    await plusBtn.click();
    await expect(volkovaRow.getByText('2 ч', { exact: true })).toBeVisible();

    // Decrement back down, clamping at 0 ч
    await minusBtn.click();
    await expect(volkovaRow.getByText('1 ч', { exact: true })).toBeVisible();
    await minusBtn.click();
    await expect(volkovaRow.getByText('0 ч', { exact: true })).toBeVisible();
    await minusBtn.click();
    await expect(volkovaRow.getByText('0 ч', { exact: true })).toBeVisible();
  });

  test('T1-F19-04: Clicking "Сохранить ведомость посещаемости" sends POST /headman/create with updated list', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({
      timeout: 5000,
    });
    await page.getByText('12.11.2026').first().click();

    const volkovaRow = page
      .locator('div, li, section')
      .filter({ hasText: 'Волкова Мария Андреевна' })
      .filter({ has: page.getByText('+', { exact: true }) })
      .last();
    await volkovaRow.getByText('+', { exact: true }).first().click();
    await volkovaRow.getByText('+', { exact: true }).first().click();

    await page.getByText(UI_LABELS.headman.saveAttendance).first().click();

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/headman/create') ?? []).filter(
            (r) => r.method === 'POST',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);

    const postReq = api
      ?.getRequestsMatching('/headman/create')
      .find((r) => r.method === 'POST');
    const body = JSON.parse(postReq?.postData ?? '{}') as {
      idLesson?: number;
      studentOmissionsHoursDtoList?: Array<{ student: number; hours: number }>;
    };
    expect(body.idLesson).toBe(5001);
    expect(body.studentOmissionsHoursDtoList).toEqual(
      expect.arrayContaining([expect.objectContaining({ student: 1, hours: 2 })]),
    );
    await expect(page.getByText(/сохранен/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F19-05: Failed /headman/subjects falls back to local demo subjects & group students cleanly', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        isHeadman: true,
        statusOverrides: {
          '/headman/subjects': 403,
          '/headman/students': 403,
          '/headman/data': 403,
        },
      },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.headmanJournal);

    await expect(page.getByText('Журнал старосты').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/ОАиП/).first()).toBeVisible();
    await expect(page.getByText(/АиСД|КСиС/).first()).toBeVisible();
    await expect(page.getByText('Соколов Алексей Дмитриевич').first()).toBeVisible();
  });
});
