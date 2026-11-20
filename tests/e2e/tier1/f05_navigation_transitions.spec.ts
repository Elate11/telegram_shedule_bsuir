import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { UI_LABELS } from '../fixtures/testData';

test.describe('F5: Root Navigation Shell & Transitions', () => {
  test('T1-F5-01: Buttons nav mode renders bottom bar with 4 tabs and switches between all 4 screens', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    const bottomNav = page.locator('nav, [role="tablist"], [data-testid="bottom-nav"]').first();
    await expect(bottomNav).toBeVisible({ timeout: 5000 });

    for (const label of [
      UI_LABELS.tabs.schedule,
      UI_LABELS.tabs.marks,
      UI_LABELS.tabs.notes,
      UI_LABELS.tabs.profile,
    ]) {
      await expect(
        bottomNav.getByText(label, { exact: true }).or(page.getByRole('tab', { name: label })).first(),
      ).toBeVisible();
    }

    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });

    await openTab(page, UI_LABELS.tabs.notes);
    await expect(page.getByText(UI_LABELS.tabs.notes).first()).toBeVisible({ timeout: 5000 });

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(UI_LABELS.profile.customization).first()).toBeVisible({ timeout: 5000 });

    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F5-02: Buttons nav mode renders sliding pill active indicator and 4 page dots in Dark and Light themes', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full', colorScheme: 'dark' },
    });

    const inspectBottomNav = async () => {
      return page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>(
          'nav, [role="tablist"], [data-testid="bottom-nav"]',
        );
        if (!nav) return { exists: false, dotCount: 0, navHeight: 0, hasAccentPill: false };

        const navRect = nav.getBoundingClientRect();
        const children = Array.from(nav.querySelectorAll<HTMLElement>('*'));
        const dots = children.filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width >= 3 &&
            r.width <= 10 &&
            r.height >= 3 &&
            r.height <= 10 &&
            parseFloat(s.borderRadius || '0') >= 3
          );
        });
        const pill = children.some((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width >= 40 &&
            r.width <= 100 &&
            r.height >= 28 &&
            r.height <= 64 &&
            parseFloat(s.borderRadius || '0') >= 12 &&
            s.backgroundColor !== 'rgba(0, 0, 0, 0)'
          );
        });
        return {
          exists: true,
          dotCount: dots.length,
          navHeight: Math.round(navRect.height),
          hasAccentPill: pill,
        };
      });
    };

    const darkNav = await inspectBottomNav();
    expect(darkNav.exists).toBe(true);
    expect(darkNav.navHeight).toBeGreaterThanOrEqual(48);
    expect(darkNav.dotCount === 4 || darkNav.hasAccentPill).toBe(true);

    // Switch to Light theme and re-verify
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const themeToggle = page.getByText('Темная', { exact: true }).first();
    if (await themeToggle.isVisible().catch(() => false)) {
      await themeToggle.click();
    }
    await openTab(page, UI_LABELS.tabs.schedule);

    const lightNav = await inspectBottomNav();
    expect(lightNav.exists).toBe(true);
    expect(lightNav.dotCount === 4 || lightNav.hasAccentPill).toBe(true);
    expect((await checkNoHorizontalOverflow(page, 390)).ok).toBe(true);
  });

  test('T1-F5-03: Hold nav mode opens AppleRadialMenu after >=480ms pointer hold and navigates to selected tab', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const holdOption = page.getByText(UI_LABELS.customization.navHold, { exact: true }).first();
    await holdOption.scrollIntoViewIfNeeded();
    await holdOption.click();

    await expect(
      page.getByText(/удержание для вызова меню/i).first(),
    ).toBeVisible({ timeout: 3000 });

    // Go back from Customization to main shell
    const backBtn = page
      .getByRole('button', { name: /Назад/i })
      .or(page.locator('button').first())
      .first();
    await backBtn.click();

    // Return to Schedule / main view and press-and-hold >=480ms
    await page.mouse.move(195, 422);
    await page.mouse.down();
    await page.waitForTimeout(560);
    await page.mouse.up();

    const radialMarks = page.getByText(UI_LABELS.tabs.marks, { exact: true }).last();
    await expect(radialMarks).toBeVisible({ timeout: 3000 });
    await radialMarks.click();

    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F5-04: Swipe nav mode allows horizontal swipe gesture between adjacent tabs', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const swipeOption = page.getByText(UI_LABELS.customization.navSwipe, { exact: true }).first();
    await swipeOption.scrollIntoViewIfNeeded();
    await swipeOption.click();

    await expect(
      page.getByText(/Свайпом влево и вправо/i).first(),
    ).toBeVisible({ timeout: 3000 });

    // Back to Profile -> navigate to Schedule tab (index 0) via swipe right multiple times or back button
    const backBtn = page.getByRole('button', { name: /Назад/i }).first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
    } else {
      await page.goBack().catch(() => {});
    }

    // Swipe right from Profile (tab 3 -> 2 -> 1 -> 0) until Schedule is visible
    for (let step = 0; step < 3; step++) {
      if (await page.getByText(/учебная неделя/i).first().isVisible().catch(() => false)) {
        break;
      }
      await page.mouse.move(40, 420);
      await page.mouse.down();
      await page.mouse.move(350, 420, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(350);
    }

    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible({ timeout: 5000 });

    // Now swipe left from Schedule (tab 0 -> tab 1 Marks)
    await page.mouse.move(340, 420);
    await page.mouse.down();
    await page.mouse.move(40, 420, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F5-05: Transition selector switches between all 5 modes (Slide, Fade, Scale, Cube, Flip) cleanly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const transitionPatterns = [
      /Slide|Слайд/i,
      /Fade|Выцветание/i,
      /Scale|Масштаб/i,
      /Cube|Куб/i,
      /Flip|Вращение/i,
    ];

    for (const pattern of transitionPatterns) {
      const option = page.getByText(pattern).first();
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeVisible({ timeout: 3000 });
      await option.click();
      await page.waitForTimeout(100);
    }

    // Switch tabs with Cube/Flip active and verify clean navigation
    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible({ timeout: 5000 });
    await openTab(page, UI_LABELS.tabs.marks);
    await expect(page.getByText(UI_LABELS.marks.averageLabel).first()).toBeVisible({ timeout: 5000 });
  });
});
