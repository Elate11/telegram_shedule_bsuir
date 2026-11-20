import {
  test,
  expect,
  bootApp,
  openTab,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F13: Notes CRUD (Tier 1)', () => {
  async function createNoteViaFab(
    page: import('@playwright/test').Page,
    opts: { text: string; subject?: string; lessonType?: 'ЛР' | 'ЛК' | 'ПЗ' },
  ) {
    const fab = page
      .getByRole('button', { name: /Создать заметку|Добавить заметку|\+/i })
      .or(page.locator('[aria-label*="Создать" i], [data-testid="add-note-fab"]'))
      .first();
    await expect(fab).toBeVisible({ timeout: 5000 });
    await fab.click();

    await expect(page.getByText('Новая заметка').first()).toBeVisible({ timeout: 5000 });

    const textInput = page
      .getByPlaceholder(/Заметка|Введите заметку/i)
      .or(page.locator('textarea'))
      .first();
    await textInput.fill(opts.text);

    if (opts.subject) {
      const subjectTrigger = page.getByText(UI_LABELS.notes.generalSubject, { exact: true }).first();
      if (await subjectTrigger.isVisible().catch(() => false)) {
        await subjectTrigger.click();
        const subjOption = page.getByText(opts.subject, { exact: true }).last();
        await expect(subjOption).toBeVisible();
        await subjOption.click();
      }
    }

    if (opts.lessonType) {
      const typeChip = page.getByText(opts.lessonType, { exact: true }).last();
      await typeChip.click();
    }

    const saveBtn = page
      .getByRole('button', { name: /Сохранить|Готово/i })
      .or(page.getByText('Сохранить', { exact: true }))
      .last();
    await saveBtn.click();
  }

  test('T1-F13-01: Tapping + FAB opens New Note sheet and creates a note with subject, type, date and time', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await createNoteViaFab(page, {
      text: 'Подготовить отчёт по ЛР №3',
      subject: 'ОАиП',
      lessonType: 'ЛР',
    });

    await expect(page.getByText('Подготовить отчёт по ЛР №3').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('ОАиП').first()).toBeVisible();
    await expect(page.getByText('ЛР').first()).toBeVisible();

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F13-02: Tapping a note edits text, toggles Pin & Remind, and moves it to Закреплённые', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await createNoteViaFab(page, {
      text: 'Исходный текст заметки',
      subject: 'ОАиП',
    });

    await page.getByText('Исходный текст заметки').first().click();
    await expect(page.getByText('Редактировать').first()).toBeVisible({ timeout: 5000 });

    const editField = page
      .getByPlaceholder(/Введите заметку|Заметка/i)
      .or(page.locator('textarea'))
      .first();
    await editField.fill('Обновлённый текст заметки');

    await page.getByText(UI_LABELS.notes.pinToggle, { exact: true }).first().click();
    const remindToggle = page
      .getByText(/Напомнить|Событие/i)
      .last();
    await remindToggle.click();

    const saveBtn = page
      .getByRole('button', { name: /Сохранить/i })
      .or(page.getByLabel(/Сохранить/i))
      .or(page.getByText('Сохранить', { exact: true }))
      .last();
    await saveBtn.click();

    await expect(page.getByText(UI_LABELS.notes.pinnedSection).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Обновлённый текст заметки').first()).toBeVisible();
  });

  test('T1-F13-03: Deleting a note removes it from list and persists deletion after reload', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await createNoteViaFab(page, { text: 'Заметка для удаления' });
    await expect(page.getByText('Заметка для удаления').first()).toBeVisible();

    await page.getByText('Заметка для удаления').first().click();
    await expect(page.getByText('Редактировать').first()).toBeVisible();

    const deleteBtn = page
      .getByRole('button', { name: UI_LABELS.notes.deleteAction })
      .or(page.getByText(UI_LABELS.notes.deleteAction, { exact: true }))
      .last();
    await deleteBtn.click();

    await expect(page.getByText('Заметка для удаления')).toHaveCount(0);

    await page.reload();
    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText('Заметка для удаления')).toHaveCount(0);
  });

  test('T1-F13-04: Filtering by subject dropdown, lesson type chips, and search accurately filters notes', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await createNoteViaFab(page, {
      text: 'Лаба по алгоритмам деревья',
      subject: 'ОАиП',
      lessonType: 'ЛР',
    });
    await createNoteViaFab(page, {
      text: 'Конспект лекции по матрицам',
      subject: 'МатАн',
      lessonType: 'ЛК',
    });

    // Lesson type filter: ЛР
    await page.getByText(/^ЛР\s*(\(\d+\))?$/).first().click();
    await expect(page.getByText('Лаба по алгоритмам деревья').first()).toBeVisible();
    await expect(page.getByText('Конспект лекции по матрицам')).toHaveCount(0);

    // Reset to Все
    await page.getByText('Все', { exact: true }).first().click();
    await expect(page.getByText('Конспект лекции по матрицам').first()).toBeVisible();

    // Subject dropdown filter
    await page.getByText(/Все предметы/i).first().click();
    await page.getByText('МатАн', { exact: true }).last().click();
    await expect(page.getByText('Конспект лекции по матрицам').first()).toBeVisible();
    await expect(page.getByText('Лаба по алгоритмам деревья')).toHaveCount(0);

    // Reset subject to Все предметы and search full-text
    await page.getByText('МатАн', { exact: true }).first().click();
    await page.getByText(/Все предметы/i).last().click();

    const searchInput = page.getByPlaceholder('Поиск').first();
    await searchInput.fill('деревья');
    await expect(page.getByText('Лаба по алгоритмам деревья').first()).toBeVisible();
    await expect(page.getByText('Конспект лекции по матрицам')).toHaveCount(0);
  });

  test('T1-F13-05: Toggling List vs 2-column Grid layout and "К след. паре" shortcut work cleanly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openTab(page, UI_LABELS.tabs.notes);

    await createNoteViaFab(page, { text: 'Первая заметка сетки' });
    await createNoteViaFab(page, { text: 'Вторая заметка сетки' });

    const viewToggleBtn = page
      .getByRole('button', { name: /Вид|Сетка|Список/i })
      .or(page.locator('[aria-label*="Вид" i], [data-testid="notes-view-toggle"]'))
      .first();
    await expect(viewToggleBtn).toBeVisible();
    await viewToggleBtn.click();

    const card1Box = await page.getByText('Первая заметка сетки').first().boundingBox();
    const card2Box = await page.getByText('Вторая заметка сетки').first().boundingBox();
    expect(card1Box).not.toBeNull();
    expect(card2Box).not.toBeNull();
    if (card1Box && card2Box) {
      // In 2-column grid, cards sit in different columns (x differs) on the same row
      expect(Math.abs(card1Box.x - card2Box.x)).toBeGreaterThan(80);
    }

    // Verify "К след. паре" shortcut in New Note sheet
    const fab = page
      .getByRole('button', { name: /Создать заметку|Добавить заметку|\+/i })
      .or(page.locator('[aria-label*="Создать" i], [data-testid="add-note-fab"]'))
      .first();
    await fab.click();

    const nextLessonBtn = page.getByText(/К след\. паре/i).first();
    await expect(nextLessonBtn).toBeVisible();
    await nextLessonBtn.click();
    // Should remain interactive and show formatted date/time chips
    await expect(page.getByText(/\d{2}:\d{2}/).first()).toBeVisible();
  });
});
