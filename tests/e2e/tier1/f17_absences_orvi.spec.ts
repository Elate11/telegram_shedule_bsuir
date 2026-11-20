import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { OMISSIONS, PERMANENT_ADDRESS, UI_LABELS } from '../fixtures/testData';

test.describe('F17: Absences & ORVI with Signature Canvas (Tier 1)', () => {
  test('T1-F17-01: Absences screen renders 3 KPI stats and monthly bar chart', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    await expect(page.getByText('За этот месяц').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('По справкам').first()).toBeVisible();
    await expect(page.getByText('Всего за семестр').first()).toBeVisible();

    // OMISSIONS has 2 unexcused, 6 excused, 8 total hours
    await expect(page.getByText('2 ч').first()).toBeVisible();
    await expect(page.getByText('6 ч').first()).toBeVisible();
    await expect(page.getByText('8 ч').first()).toBeVisible();

    // Monthly bar chart labels
    await expect(page.getByText('Сен').first()).toBeVisible();
    await expect(page.getByText('Окт').first()).toBeVisible();
    await expect(page.getByText('Ноя').first()).toBeVisible();

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F17-02: Excuse documents list combines /omissions-by-student and /certificate records', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    await expect(page.getByText('Оправдательные документы').first()).toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByText(/Поликлиника №33/).first()).toBeVisible();
    await expect(
      page.getByText(/По месту работы родителей|Медицинская справка 095\/у/i).first(),
    ).toBeVisible();

    expect((api?.getRequestsMatching('/omissions-by-student') ?? []).length).toBeGreaterThanOrEqual(1);
    expect((api?.getRequestsMatching('/certificate') ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('T1-F17-03: Detailed missed lessons list displays lesson info, respectful status, and supports month filtering', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    const lessons = OMISSIONS[0].student.lessons;
    await expect(page.getByText(lessons[0].nameLesson).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(lessons[0].teacher).first()).toBeVisible();
    await expect(page.getByText('Без уважительной').first()).toBeVisible();
    await expect(page.getByText('Уважительная').first()).toBeVisible();

    // Click month bar "Окт" to filter down to October's Физика lesson
    await page.getByText('Окт', { exact: true }).first().click();
    await expect(page.getByText('Физика').first()).toBeVisible();
    await expect(page.getByText('Математический анализ')).toHaveCount(0);
  });

  test('T1-F17-04: "Подать заявку на ОРВИ" opens modal with auto-filled permanent address and date pickers', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    await page.getByText(UI_LABELS.studyAndOrvi.applyOrvi).first().click();
    await expect(
      page.getByText(/Оформление заявления по ОРВИ/i).first(),
    ).toBeVisible({ timeout: 5000 });

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/student-details/permanent-address') ?? []).length,
      )
      .toBeGreaterThanOrEqual(1);

    // Permanent address auto-filled
    const addrInput = page
      .getByPlaceholder(/Республика Беларусь|Минск|адрес/i)
      .or(page.locator('input[type="text"], textarea'))
      .filter({ hasText: /^$/ })
      .or(page.locator('input[value*="Бровки"], textarea'));
    await expect(addrInput.first()).toHaveValue(PERMANENT_ADDRESS, { timeout: 5000 });

    await expect(page.getByText('Дата начала').first()).toBeVisible();
    await expect(page.getByText('Дата окончания').first()).toBeVisible();
  });

  test('T1-F17-05: Drawing signature strokes on fullscreen canvas produces non-empty PNG and submits POST /omissions/create', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.absences);

    await page.getByText(UI_LABELS.studyAndOrvi.applyOrvi).first().click();
    await expect(
      page.getByText(/Оформление заявления по ОРВИ/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Open fullscreen signature canvas
    const signBoxTrigger = page
      .getByText(/Подпись заявления|Нажмите, чтобы расписаться|Поле для подписи/i)
      .first();
    await signBoxTrigger.click();

    const canvas = page.locator('canvas').last();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, {
        steps: 8,
      });
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.35, {
        steps: 8,
      });
      await page.mouse.up();
    }

    const canvasDataUrl = await canvas.evaluate((el) =>
      (el as HTMLCanvasElement).toDataURL('image/png'),
    );
    expect(canvasDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(canvasDataUrl.length).toBeGreaterThan(200);

    await page.getByText(UI_LABELS.studyAndOrvi.saveSignature).first().click();
    await page.getByText(UI_LABELS.studyAndOrvi.submitOrvi).first().click();

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/omissions/create') ?? []).filter(
            (r) => r.method === 'POST',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);

    const createReq = api
      ?.getRequestsMatching('/omissions/create')
      .find((r) => r.method === 'POST');
    expect(createReq?.postData).toBeTruthy();
    const parsed = JSON.parse(createReq?.postData ?? '{}') as Record<string, unknown>;
    const serialized = JSON.stringify(parsed);
    // Non-empty base64 PNG / signature payload included
    expect(serialized.length).toBeGreaterThan(100);
  });
});
