import {
  test,
  expect,
  bootApp,
  openTab,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F11: Marks & Personal Rating (MarksScreen)', () => {
  test('T1-F11-01: Marks screen renders GPA and Labs KPI cards with performance badge', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.marks);

    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(UI_LABELS.marks.labsLabel).first()).toBeVisible();

    // PERSONAL_RATING has marks [9,10,9,8,8,7,9] => avg 8.57 (8.6) -> Отлично or Хорошо
    await expect(page.getByText(/8[.,]57|8[.,]6/).first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(new RegExp(`${UI_LABELS.marks.excellent}|${UI_LABELS.marks.good}|${UI_LABELS.marks.satisfactory}`)).first(),
    ).toBeVisible();
  });

  test('T1-F11-02: Subject cards display lab progress bars and grouped mark badges (ЛР, ПЗ, ЛК)', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.marks);

    await expect(
      page.getByText('Основы алгоритмизации и программирования').first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/3 из 4 сдано/).first()).toBeVisible();
    await expect(page.getByText(/1 из 4 сдано/).first()).toBeVisible();

    await expect(page.getByText('ЛР').first()).toBeVisible();
    await expect(page.getByText('ЛК').first()).toBeVisible();
    await expect(page.getByText('ПЗ').first()).toBeVisible();
    await expect(page.getByText('10', { exact: true }).first()).toBeVisible();
  });

  test('T1-F11-03: Search input filters subjects by name/abbreviation', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.marks);

    const searchInput = page.getByPlaceholder('Поиск').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('АиСД');

    await expect(page.getByText('Алгоритмы и структуры данных').first()).toBeVisible();
    await expect(page.getByText('Основы алгоритмизации и программирования')).toHaveCount(0);
    await expect(page.getByText('Математический анализ')).toHaveCount(0);
  });

  test('T1-F11-04: Filter chips (Все / Лабораторные / С оценками) narrow displayed subjects accurately', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.marks);

    await expect(page.getByText('Математический анализ').first()).toBeVisible({ timeout: 5000 });

    // "Лабораторные" filter: МатАн has no ЛР, so it should be filtered out; ОАиП and АиСД remain
    await page.getByText(UI_LABELS.marks.filterLabs, { exact: true }).first().click();
    await expect(page.getByText('Основы алгоритмизации и программирования').first()).toBeVisible();
    await expect(page.getByText('Алгоритмы и структуры данных').first()).toBeVisible();
    await expect(page.getByText('Математический анализ')).toHaveCount(0);

    // "С оценками" filter: subjects with marks remain visible
    await page.getByText(UI_LABELS.marks.filterGraded, { exact: true }).first().click();
    await expect(page.getByText('Основы алгоритмизации и программирования').first()).toBeVisible();

    // "Все" restores all 3 subjects
    await page.getByText(UI_LABELS.marks.filterAll, { exact: true }).first().click();
    await expect(page.getByText('Математический анализ').first()).toBeVisible();
  });

  test('T1-F11-05: In Guest/unauthenticated mode, Marks shows sync banner and falls back to schedule-derived subjects without errors', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });
    await openTab(page, UI_LABELS.tabs.marks);

    await expect(
      page.getByText(/Синхронизация с ИИС БГУИР|Войдите в профиле/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Schedule-derived fallback subjects from 510902
    await expect(page.getByText(/ОАиП|Основы алгоритмизации/i).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
