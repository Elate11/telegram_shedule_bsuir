import {
  test,
  expect,
  bootApp,
  openTab,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F4: LiquidGlass & AppleDesign Primitives', () => {
  test('T1-F4-01: LiquidGlass surfaces apply backdrop blur and glass/border styling across cards and floating controls', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });

    const glassStats = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
      let blurCount = 0;
      let roundedCardCount = 0;

      for (const el of all) {
        const s = getComputedStyle(el);
        const bf = s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || '';
        if (bf && bf !== 'none' && bf.includes('blur(')) {
          blurCount++;
        }
        const br = parseFloat(s.borderRadius || '0');
        const rect = el.getBoundingClientRect();
        if (br >= 8 && rect.width >= 100 && rect.height >= 40) {
          roundedCardCount++;
        }
      }

      return { blurCount, roundedCardCount };
    });

    expect(glassStats.blurCount).toBeGreaterThanOrEqual(1);
    expect(glassStats.roundedCardCount).toBeGreaterThanOrEqual(1);
  });

  test('T1-F4-02: AppleSearchInput accepts typing, displays placeholder, and clears query via clear button', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.marks);

    const searchInput = page.getByPlaceholder('Поиск').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('ОАиП');
    await expect(searchInput).toHaveValue('ОАиП');
    await expect(page.getByText('Основы алгоритмизации и программирования').first()).toBeVisible();
    await expect(page.getByText('Алгоритмы и структуры данных')).toHaveCount(0);

    // Clear button next to search input
    const clearBtn = searchInput
      .locator('..')
      .locator('button, [role="button"]')
      .first();
    await expect(clearBtn).toBeVisible({ timeout: 3000 });
    await clearBtn.click();

    await expect(searchInput).toHaveValue('');
    await expect(page.getByText('Алгоритмы и структуры данных').first()).toBeVisible();
  });

  test('T1-F4-03: AppleOptionChip group toggles active pill styling and selected state on click', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    const chipAll = page.getByText(UI_LABELS.schedule.allSubgroups, { exact: true }).first();
    const chipSg1 = page.getByText(UI_LABELS.schedule.subgroup1, { exact: true }).first();
    await expect(chipAll).toBeVisible({ timeout: 5000 });
    await expect(chipSg1).toBeVisible({ timeout: 5000 });

    const beforeStyles = await Promise.all([
      chipAll.evaluate((el) => ({
        bg: getComputedStyle(el.closest('button, [role="tab"], [role="button"], div') ?? el).backgroundColor,
        ariaPressed: el.getAttribute('aria-pressed') ?? el.closest('button')?.getAttribute('aria-pressed'),
      })),
      chipSg1.evaluate((el) => ({
        bg: getComputedStyle(el.closest('button, [role="tab"], [role="button"], div') ?? el).backgroundColor,
        ariaPressed: el.getAttribute('aria-pressed') ?? el.closest('button')?.getAttribute('aria-pressed'),
      })),
    ]);

    await chipSg1.click();
    await page.waitForTimeout(150);

    const afterStyles = await Promise.all([
      chipAll.evaluate((el) => ({
        bg: getComputedStyle(el.closest('button, [role="tab"], [role="button"], div') ?? el).backgroundColor,
        ariaPressed: el.getAttribute('aria-pressed') ?? el.closest('button')?.getAttribute('aria-pressed'),
      })),
      chipSg1.evaluate((el) => ({
        bg: getComputedStyle(el.closest('button, [role="tab"], [role="button"], div') ?? el).backgroundColor,
        ariaPressed: el.getAttribute('aria-pressed') ?? el.closest('button')?.getAttribute('aria-pressed'),
      })),
    ]);

    expect(
      afterStyles[1].bg !== beforeStyles[1].bg ||
        afterStyles[1].ariaPressed === 'true' ||
        afterStyles[0].bg !== beforeStyles[0].bg,
    ).toBe(true);
  });

  test('T1-F4-04: IosDatePickerModal and IosTimePickerModal open, select date/time, and confirm values into Note form', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T10:00:00',
    });

    await openTab(page, UI_LABELS.tabs.notes);

    // Open New Note sheet via + FAB
    const fab = page
      .getByRole('button', { name: /Добавить|Создать|\+/i })
      .or(page.locator('button').filter({ hasText: '+' }))
      .last();
    await fab.click();

    await expect(
      page.getByText(/Новая заметка|Заметка/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Open Date picker modal
    const dateBtn = page
      .getByRole('button', { name: /\d{2}\.\d{2}\.\d{4}|Дата/i })
      .first();
    await expect(dateBtn).toBeVisible({ timeout: 3000 });
    const initialDateLabel = await dateBtn.innerText();
    await dateBtn.click();

    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Pick another day in the dialog (e.g., day 20 or 21)
    const dayCell = dialog.getByText('21', { exact: true }).first();
    if (await dayCell.isVisible().catch(() => false)) {
      await dayCell.click();
    }
    const confirmDateBtn = dialog
      .getByRole('button', { name: /Готово|Выбрать|ОК|Применить/i })
      .first();
    if (await confirmDateBtn.isVisible().catch(() => false)) {
      await confirmDateBtn.click();
    }

    // Enable reminder toggle if time picker appears on event toggle
    const remindSwitch = page
      .getByText(UI_LABELS.notes.remindToggle, { exact: false })
      .first();
    if (await remindSwitch.isVisible().catch(() => false)) {
      await remindSwitch.click();
    }

    const timeBtn = page
      .getByRole('button', { name: /\d{2}:\d{2}|Время/i })
      .first();
    if (await timeBtn.isVisible().catch(() => false)) {
      await timeBtn.click();
      const timeDialog = page.getByRole('dialog').last();
      await expect(timeDialog).toBeVisible({ timeout: 3000 });
      const confirmTimeBtn = timeDialog
        .getByRole('button', { name: /Готово|Выбрать|ОК|Применить/i })
        .first();
      if (await confirmTimeBtn.isVisible().catch(() => false)) {
        await confirmTimeBtn.click();
      }
    }

    const updatedDateLabel = await dateBtn.innerText();
    expect(updatedDateLabel.length).toBeGreaterThan(0);
    // If day 21 was clickable, expect date updated
    if (initialDateLabel.includes('19.11')) {
      expect(updatedDateLabel).toContain('21');
    }
  });

  test('T1-F4-05: ApplePullToRefresh responds to downward pointer drag on Schedule and triggers refresh', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    expect(api).not.toBeNull();
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
    api!.clearRequests();

    await page.mouse.move(195, 220);
    await page.mouse.down();
    await page.mouse.move(195, 480, { steps: 18 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    const scheduleRequests = api!.getRequestsMatching('/schedule');
    expect(scheduleRequests.length).toBeGreaterThanOrEqual(1);
    await expect(page.getByText('ОАиП').first()).toBeVisible();
  });
});
