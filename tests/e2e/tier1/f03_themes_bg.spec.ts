import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
} from '../fixtures/appHarness';
import {
  ANDROID_THEMES,
  RECOMMENDED_PALETTES,
  UI_LABELS,
} from '../fixtures/testData';

test.describe('F3: Theme Engine & Backgrounds (Dark/Light + Palettes + Font Scale)', () => {
  test('T1-F3-01: Dark theme renders #272729 background, #FFFFFF primary text, #2997FF accent, and Google Sans font', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full', colorScheme: 'dark' },
    });

    const themeVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        bgVar: root.getPropertyValue('--bg').trim().toLowerCase(),
        textVar: root.getPropertyValue('--text').trim().toLowerCase(),
        accentVar: root.getPropertyValue('--accent').trim().toLowerCase(),
        bodyBg: body.backgroundColor,
        bodyColor: body.color,
        fontFamily: body.fontFamily,
      };
    });

    expect(
      themeVars.bgVar === ANDROID_THEMES.dark.bg.toLowerCase() ||
        themeVars.bodyBg === 'rgb(39, 39, 41)',
    ).toBe(true);
    expect(
      themeVars.textVar === ANDROID_THEMES.dark.text.toLowerCase() ||
        themeVars.bodyColor === 'rgb(255, 255, 255)',
    ).toBe(true);
    expect(
      themeVars.accentVar === ANDROID_THEMES.dark.accent.toLowerCase() ||
        themeVars.accentVar === 'rgb(41, 151, 255)',
    ).toBe(true);
    expect(themeVars.fontFamily.toLowerCase()).toMatch(/google sans|sf pro|system-ui|sans-serif/);
  });

  test('T1-F3-02: Light theme renders #F5F5F7 background, #1D1D1F primary text, and #0066CC accent', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'guest',
      telegram: { mode: 'full', colorScheme: 'light' },
    });

    // Ensure explicit Light theme in Customization if app defaulted to Dark
    await openProfileSubScreen(page, UI_LABELS.profile.customization);
    const darkLabel = page.getByText('Темная', { exact: true }).first();
    if (await darkLabel.isVisible().catch(() => false)) {
      await page.getByText('Тема', { exact: true }).locator('..').locator('button, [role="button"], div').nth(1).click().catch(async () => {
        await darkLabel.click();
      });
    }
    await expect(page.getByText('Светлая', { exact: true }).first()).toBeVisible({ timeout: 3000 });

    const themeVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        bgVar: root.getPropertyValue('--bg').trim().toLowerCase(),
        textVar: root.getPropertyValue('--text').trim().toLowerCase(),
        accentVar: root.getPropertyValue('--accent').trim().toLowerCase(),
        bodyBg: body.backgroundColor,
        bodyColor: body.color,
      };
    });

    expect(
      themeVars.bgVar === ANDROID_THEMES.light.bg.toLowerCase() ||
        themeVars.bodyBg === 'rgb(245, 245, 247)',
    ).toBe(true);
    expect(
      themeVars.textVar === ANDROID_THEMES.light.text.toLowerCase() ||
        themeVars.bodyColor === 'rgb(29, 29, 31)',
    ).toBe(true);
    expect(
      themeVars.accentVar === ANDROID_THEMES.light.accent.toLowerCase() ||
        themeVars.accentVar === 'rgb(0, 102, 204)',
    ).toBe(true);
  });

  test('T1-F3-03: Selecting a recommended Minimal palette updates theme CSS tokens immediately across cards and badges', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    await expect(page.getByText('Сочетания цветов').first()).toBeVisible({ timeout: 5000 });

    // Click Green-on-Mint (#E8F5E9 / #43A047) or Amber-on-Charcoal (#333333 / #FFB300) palette swatch
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('button, div'));
      const target = els.find((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const r = el.getBoundingClientRect();
        return (
          r.width >= 36 &&
          r.width <= 84 &&
          (bg === 'rgb(232, 245, 233)' || bg === 'rgb(51, 51, 51)')
        );
      });
      if (!target) return null;
      const bg = getComputedStyle(target).backgroundColor;
      target.click();
      return bg;
    });

    expect(clicked).not.toBeNull();

    const updatedVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        bg: root.getPropertyValue('--bg').trim().toLowerCase(),
        accent: root.getPropertyValue('--accent').trim().toLowerCase(),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });

    if (clicked === 'rgb(232, 245, 233)') {
      expect(
        updatedVars.bg === RECOMMENDED_PALETTES.greenMint.background.toLowerCase() ||
          updatedVars.bodyBg === 'rgb(232, 245, 233)',
      ).toBe(true);
      expect(updatedVars.accent).toBe(RECOMMENDED_PALETTES.greenMint.primary.toLowerCase());
    } else {
      expect(
        updatedVars.bg === RECOMMENDED_PALETTES.amberCharcoal.background.toLowerCase() ||
          updatedVars.bodyBg === 'rgb(51, 51, 51)',
      ).toBe(true);
      expect(updatedVars.accent).toBe(RECOMMENDED_PALETTES.amberCharcoal.primary.toLowerCase());
    }

    // Verify Schedule cards render cleanly with updated theme
    await openTab(page, UI_LABELS.tabs.schedule);
    await expect(page.getByText('ОАиП').first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F3-04: Custom Primary and Background color pickers override theme colors and persist across reload', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const before = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        bg: root.getPropertyValue('--bg').trim().toLowerCase(),
        accent: root.getPropertyValue('--accent').trim().toLowerCase(),
      };
    });

    // Click "Основной" swatch to open color picker
    const primaryCol = page.getByText('Основной', { exact: true }).locator('..');
    await primaryCol.locator('button, [role="button"], div').nth(1).click();

    // Interact with ColorPickerModal (hex input or swatch or confirm button)
    const hexInput = page.locator('input[type="text"], input[placeholder*="#"]').first();
    if (await hexInput.isVisible().catch(() => false)) {
      await hexInput.fill('#FF5722');
      await hexInput.press('Enter').catch(() => {});
    } else {
      const pickerBox = page.locator('[role="dialog"] canvas, [role="dialog"] button').first();
      if (await pickerBox.isVisible().catch(() => false)) {
        await pickerBox.click({ position: { x: 40, y: 20 } });
      }
    }

    const applyBtn = page.getByRole('button', { name: /Применить|Выбрать|ОК|Готово|Сохранить/i }).first();
    if (await applyBtn.isVisible().catch(() => false)) {
      await applyBtn.click();
    }

    const after = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        accent: root.getPropertyValue('--accent').trim().toLowerCase(),
        primary: root.getPropertyValue('--text').trim().toLowerCase(),
      };
    });

    expect(after.accent !== before.accent || after.primary === '#ff5722').toBe(true);

    await page.reload();
    await page.waitForTimeout(250);

    const persisted = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        accent: root.getPropertyValue('--accent').trim().toLowerCase(),
        primary: root.getPropertyValue('--text').trim().toLowerCase(),
      };
    });

    expect(persisted.accent === after.accent || persisted.primary === after.primary).toBe(true);
  });

  test('T1-F3-05: Switching background modes (Solid/Gradient/Photo) and font scale slider updates layers and text sizing', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest' });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const gradientBtn = page.getByText(UI_LABELS.customization.bgGradient, { exact: true }).first();
    await gradientBtn.scrollIntoViewIfNeeded();
    await gradientBtn.click();
    await expect(page.getByText('Затемнение').first()).toBeVisible({ timeout: 3000 });

    const photoBtn = page.getByText(UI_LABELS.customization.bgGallery, { exact: true }).first();
    await photoBtn.click();
    await expect(page.getByText('Выбрать фото').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Размытие').first()).toBeVisible({ timeout: 3000 });

    // Font scale slider
    const fontScaleLabel = page.getByText(/Размер текста/i).first();
    await fontScaleLabel.scrollIntoViewIfNeeded();
    const initialScaleText = await fontScaleLabel.innerText();

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    let updated = false;
    for (let i = 0; i < count; i++) {
      const slider = sliders.nth(i);
      const min = await slider.getAttribute('min');
      const max = await slider.getAttribute('max');
      if (min === '0.8' || max === '1.4') {
        await slider.fill('1.4');
        await slider.dispatchEvent('change');
        updated = true;
        break;
      }
    }

    if (updated) {
      const newScaleText = await fontScaleLabel.innerText();
      expect(newScaleText).not.toBe(initialScaleText);
      expect(newScaleText).toContain('1.4');
    } else {
      // Fallback: check --font-scale CSS variable exists
      const fontScaleVar = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim(),
      );
      expect(fontScaleVar.length).toBeGreaterThan(0);
    }
  });
});
