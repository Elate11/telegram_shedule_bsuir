import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { MARKBOOK, UI_LABELS, type MockMarkbookResponse } from '../fixtures/testData';

test.describe('F12: Gradebook (Tier 1)', () => {
  test('T1-F12-01: Gradebook screen opens from Profile and renders semester cards from /markbook', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });

    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    await expect(page.getByText(/Зач[её]тка/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Семестр 1').first()).toBeVisible();
    await expect(page.getByText('Семестр 2').first()).toBeVisible();

    const markbookCalls = api?.getRequestsMatching('/markbook') ?? [];
    expect(markbookCalls.length).toBeGreaterThanOrEqual(1);

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F12-02: Semester cards display subjects, control types, and color-coded marks', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    const oapRow = page.getByText('Основы алгоритмизации и программирования').first();
    await expect(oapRow).toBeVisible();
    await expect(page.getByText('Математический анализ').first()).toBeVisible();
    await expect(page.getByText('Физическая культура').first()).toBeVisible();
    await expect(page.getByText('Физика').first()).toBeVisible();

    // Control types / marks visible
    await expect(page.getByText('Зачет', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Экзамен', { exact: false }).first()).toBeVisible();

    const mark9 = page.getByText('9', { exact: true }).first();
    const mark8 = page.getByText('8', { exact: true }).first();
    const mark6 = page.getByText('6', { exact: true }).first();
    await expect(mark9).toBeVisible();
    await expect(mark8).toBeVisible();
    await expect(mark6).toBeVisible();

    // Verify color-coding semantics: 9 (greenish), 8 (bluish), 6 (warm/orange/amber)
    const parseRgb = (rgb: string) => {
      const m = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
      return { r: m[0] ?? 0, g: m[1] ?? 0, b: m[2] ?? 0 };
    };

    const color9 = parseRgb(
      await mark9.evaluate((el) => getComputedStyle(el).color),
    );
    const color8 = parseRgb(
      await mark8.evaluate((el) => getComputedStyle(el).color),
    );
    const color6 = parseRgb(
      await mark6.evaluate((el) => getComputedStyle(el).color),
    );

    expect(color9.g).toBeGreaterThan(color9.r);
    expect(color9.g).toBeGreaterThan(color9.b);
    expect(color8.b).toBeGreaterThan(color8.r);
    expect(color6.r).toBeGreaterThan(color6.b);
  });

  test('T1-F12-03: Per-semester average mark is accurately calculated over numeric marks', async ({
    page,
  }) => {
    const customMarkbook: MockMarkbookResponse = {
      ...MARKBOOK,
      markPages: {
        '1': {
          averageMark: 9.0,
          marks: [
            {
              subject: 'ОАиП',
              mark: '9',
              formOfControl: 'Экзамен',
              date: '14.01.2026',
              teacher: 'Азаров И. В.',
              hours: 144,
            },
            {
              subject: 'МатАн',
              mark: '8',
              formOfControl: 'Экзамен',
              date: '18.01.2026',
              teacher: 'Иванов С. А.',
              hours: 180,
            },
            {
              subject: 'ЛАиАГ',
              mark: '10',
              formOfControl: 'Экзамен',
              date: '22.01.2026',
              teacher: 'Иванов С. А.',
              hours: 120,
            },
            {
              subject: 'Физическая культура',
              mark: 'Зачет',
              formOfControl: 'Зачет',
              date: '28.12.2025',
              teacher: 'Сидоров П. П.',
              hours: 72,
            },
          ],
        },
      },
    };

    await bootApp(page, {
      mode: 'authenticated',
      api: { payloadOverrides: { markbook: customMarkbook } },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    await expect(page.getByText('Средний балл').first()).toBeVisible();
    // (9 + 8 + 10) / 3 = 9.00 (Зачет excluded)
    await expect(page.getByText(/9[.,]00?/).first()).toBeVisible();
  });

  test('T1-F12-04: Ungraded subjects show "— (formOfControl)" cleanly without breaking semester GPA', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);

    await expect(page.getByText('Алгоритмы и структуры данных').first()).toBeVisible();
    // Ungraded subject in MARKBOOK sem 2 has mark: null, formOfControl: 'Экзамен'
    await expect(page.getByText(/—\s*\(Экзамен\)/).first()).toBeVisible();

    // Ensure no NaN appears anywhere in semester GPA display
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    await expect(page.getByText('Средний балл').nth(1)).toBeVisible();
  });

  test('T1-F12-05: Back navigation returns cleanly from Gradebook to Profile hub', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.gradebook);
    await expect(page.getByText('Семестр 1').first()).toBeVisible();

    const backBtn = page
      .getByRole('button', { name: /Назад/i })
      .or(page.getByLabel(/Назад/i))
      .or(page.locator('[aria-label*="Назад" i], [data-testid="back-button"]'))
      .first();
    await backBtn.click();

    await expect(page.getByText(UI_LABELS.profile.notifications).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.profile.logout).first()).toBeVisible();
  });
});
