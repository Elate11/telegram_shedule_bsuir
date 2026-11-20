import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { PERSONAL_CV, UI_LABELS } from '../fixtures/testData';

test.describe('F21: IIS Resume & Widget Preview (Tier 1)', () => {
  test('T1-F21-01: Interactive schedule widget preview navigates days and exposes iCal export link', async ({
    page,
  }) => {
    // Freeze on a Monday so ‹ / › day shifts change weekday/date deterministically
    await bootApp(page, {
      mode: 'authenticated',
      clockDate: '2026-11-16T10:00:00',
    });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText('Виджет расписания').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('510902').first()).toBeVisible();

    const nextArrow = page.getByText('›', { exact: true }).first();
    const prevArrow = page.getByText('‹', { exact: true }).first();
    await expect(nextArrow).toBeVisible();
    await expect(prevArrow).toBeVisible();

    await nextArrow.click();
    // Next day (Tuesday) shows Tuesday's date (17.11) or weekday label
    await expect(page.getByText(/17\.11|Вторник/i).first()).toBeVisible({
      timeout: 3000,
    });

    await prevArrow.click();
    await expect(page.getByText(/16\.11|Понедельник/i).first()).toBeVisible({
      timeout: 3000,
    });

    // iCal export link/button
    await expect(page.getByText(/iCal/i).first()).toBeVisible();

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F21-02: 3 CV privacy switches trigger PUT /profiles/... updates', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    const toggleLabel = async (label: string) => {
      const row = page
        .locator('div, label, li')
        .filter({ hasText: label })
        .filter({ has: page.locator('input[type="checkbox"], [role="switch"]') })
        .last();
      const ctrl = row.locator('input[type="checkbox"], [role="switch"]').first();
      await expect(ctrl).toBeVisible({ timeout: 5000 });
      await ctrl.click();
    };

    await toggleLabel('Профиль опубликован');
    await toggleLabel('Отображать в рейтинге');
    await toggleLabel('Активно ищу работу / стажировку');

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/personal-cv-published') ?? []).filter(
            (r) => r.method === 'PUT',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/personal-cv-rating') ?? []).filter(
            (r) => r.method === 'PUT',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/personal-cv-searching-job') ?? []).filter(
            (r) => r.method === 'PUT',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);
  });

  test('T1-F21-03: "О себе" summary edit dialog updates bio via PUT /profiles/summary and persists in UI', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText(PERSONAL_CV.summary).first()).toBeVisible({
      timeout: 5000,
    });

    const aboutSection = page
      .locator('div, section')
      .filter({ hasText: 'О себе' })
      .filter({ has: page.getByText(/Изменить|Редактировать/i) })
      .last();
    if (await aboutSection.count() > 0) {
      await aboutSection.getByText(/Изменить|Редактировать/i).first().click();
    } else {
      await page.getByText(PERSONAL_CV.summary).first().click();
    }

    const bioInput = page.locator('textarea, input[type="text"]').last();
    await expect(bioInput).toBeVisible({ timeout: 5000 });
    const newBio = 'React и TypeScript инженер в БГУИР';
    await bioInput.fill(newBio);

    await page
      .getByRole('button', { name: 'Сохранить' })
      .or(page.getByText('Сохранить', { exact: true }))
      .last()
      .click();

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/summary') ?? []).filter(
            (r) => r.method === 'PUT',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);

    await expect(page.getByText(newBio).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F21-04: Skills add/remove (POST /profiles/my-skills) and Links add/remove (PUT /profiles/my-references) update lists', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(page.getByText('TypeScript').first()).toBeVisible({ timeout: 5000 });

    // Add Skill
    const skillsHeader = page
      .locator('div, section')
      .filter({ hasText: /Навыки/i })
      .filter({ has: page.getByText('Добавить', { exact: true }) })
      .last();
    await skillsHeader.getByText('Добавить', { exact: true }).first().click();

    await page.locator('input[type="text"]').last().fill('Playwright');
    await page.getByText('Добавить', { exact: true }).last().click();

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/my-skills') ?? []).filter(
            (r) => r.method === 'POST',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByText('Playwright').first()).toBeVisible({ timeout: 5000 });

    // Remove skill 'Kotlin'
    const kotlinChip = page
      .locator('div, span, li')
      .filter({ hasText: /^Kotlin$/ })
      .locator('..')
      .locator('button, [aria-label*="Удалить" i], svg')
      .last();
    if (await kotlinChip.isVisible().catch(() => false)) {
      await kotlinChip.click();
      await expect(page.getByText('Kotlin', { exact: true })).toHaveCount(0);
    }

    // Add Reference Link
    const linksHeader = page
      .locator('div, section')
      .filter({ hasText: /Ссылки и контакты/i })
      .filter({ has: page.getByText('Добавить', { exact: true }) })
      .last();
    await linksHeader.getByText('Добавить', { exact: true }).first().click();

    const modalInputs = page.locator('input[type="text"]');
    const inputCount = await modalInputs.count();
    await modalInputs.nth(Math.max(0, inputCount - 2)).fill('Portfolio');
    await modalInputs.nth(Math.max(0, inputCount - 1)).fill('https://example.com');
    await page.getByText('Добавить', { exact: true }).last().click();

    await expect
      .poll(
        () =>
          (api?.getRequestsMatching('/profiles/my-references') ?? []).filter(
            (r) => r.method === 'PUT',
          ).length,
      )
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByText('Portfolio').first()).toBeVisible({ timeout: 5000 });

    // Remove link 'Telegram'
    const telegramRow = page
      .locator('div, li')
      .filter({ hasText: 'https://t.me/sokolov_bsuir' })
      .locator('button, [aria-label*="Удалить" i]')
      .last();
    if (await telegramRow.isVisible().catch(() => false)) {
      await telegramRow.click();
      await expect(page.getByText('https://t.me/sokolov_bsuir')).toHaveCount(0);
    }
  });

  test('T1-F21-05: Corporate BSUIR Outlook section displays email & password and copies credentials on tap', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { __copiedTexts: string[] }).__copiedTexts = copied;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copied.push(text);
          },
        },
      });
    });

    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.iisResume);

    await expect(
      page.getByText(/Корпоративный аккаунт БГУИР/i).first(),
    ).toBeVisible({ timeout: 5000 });

    const emailRow = page.getByText(new RegExp(PERSONAL_CV.officeEmail)).first();
    const passRow = page.getByText(new RegExp(PERSONAL_CV.officePassword)).first();
    await expect(emailRow).toBeVisible();
    await expect(passRow).toBeVisible();

    await emailRow.click();
    await passRow.click();

    const copied = await page.evaluate(
      () => (window as unknown as { __copiedTexts?: string[] }).__copiedTexts ?? [],
    );
    expect(copied).toContain(PERSONAL_CV.officeEmail);
    expect(copied).toContain(PERSONAL_CV.officePassword);
  });
});
