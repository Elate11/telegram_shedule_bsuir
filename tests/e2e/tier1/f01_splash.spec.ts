import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
} from '../fixtures/appHarness';
import { ANDROID_THEMES, UI_LABELS } from '../fixtures/testData';

test.describe('F1: Intro Splash (BsuirIntroSplash)', () => {
  test('T1-F1-01: Fresh launch renders full-screen dark #101116 splash overlay with BSUIR logo/canvas above auth screen', async ({
    page,
  }) => {
    await bootApp(page, { skipSplash: false, mode: 'raw' });

    const splashInfo = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="intro-splash"], [aria-label*="интро" i], [aria-label*="splash" i], canvas, div',
        ),
      );

      let fullscreenEl: HTMLElement | null = null;
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const bg = style.backgroundColor;
        const isFullscreen = rect.width >= 380 && rect.height >= 800;
        const isDarkSplashBg =
          bg === 'rgb(16, 17, 22)' ||
          bg === 'rgba(16, 17, 22, 1)' ||
          style.position === 'fixed';
        if (isFullscreen && isDarkSplashBg) {
          fullscreenEl = el;
          break;
        }
      }

      const hasVisualElement =
        document.querySelector('canvas, svg, img[alt*="БГУИР" i], img[alt*="BSUIR" i]') !== null;

      return {
        foundFullscreen: fullscreenEl !== null,
        bg: fullscreenEl ? getComputedStyle(fullscreenEl).backgroundColor : null,
        rect: fullscreenEl
          ? {
              w: Math.round(fullscreenEl.getBoundingClientRect().width),
              h: Math.round(fullscreenEl.getBoundingClientRect().height),
            }
          : null,
        hasVisualElement,
      };
    });

    expect(splashInfo.foundFullscreen).toBe(true);
    expect(splashInfo.hasVisualElement).toBe(true);
    expect(splashInfo.rect?.w).toBeGreaterThanOrEqual(380);
    expect(splashInfo.rect?.h).toBeGreaterThanOrEqual(800);
    if (splashInfo.bg && splashInfo.bg !== 'rgba(0, 0, 0, 0)') {
      expect(splashInfo.bg).toBe('rgb(16, 17, 22)');
    }
    expect(ANDROID_THEMES.splashBg).toBe('#101116');
  });

  test('T1-F1-02: Tap anywhere on splash skips immediately and reveals Login screen within ~500ms', async ({
    page,
  }) => {
    await bootApp(page, { skipSplash: false, mode: 'raw' });

    await page.mouse.click(195, 422);

    const loginMarker = page
      .getByRole('button', { name: UI_LABELS.auth.loginButton, exact: true })
      .or(page.getByText(UI_LABELS.auth.guestButton))
      .first();

    await expect(loginMarker).toBeVisible({ timeout: 1200 });
  });

  test('T1-F1-03: Splash auto-completes and dismisses after ~4s without user interaction', async ({
    page,
  }) => {
    await bootApp(page, { skipSplash: false, mode: 'raw' });

    const guestBtn = page
      .getByRole('button', { name: UI_LABELS.auth.guestButton })
      .or(page.getByText(UI_LABELS.auth.guestButton))
      .first();

    // Wait without clicking — splash auto-dismisses around 4s
    await expect(guestBtn).toBeVisible({ timeout: 6500 });
  });

  test('T1-F1-04: Disabling "Интро при входе" in Customization suppresses splash on subsequent reload', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest', skipSplash: true });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const introLabel = page.getByText(UI_LABELS.customization.introToggle).first();
    await introLabel.scrollIntoViewIfNeeded();
    await expect(introLabel).toBeVisible({ timeout: 5000 });

    const introSwitch = page
      .getByRole('switch', { name: /Интро при входе/i })
      .or(introLabel.locator('..').locator('input[type="checkbox"], [role="switch"], button'))
      .first();

    await introSwitch.click();
    await page.waitForTimeout(200);

    await page.reload();

    // Auth or main content should be immediately reachable without waiting 4s for splash
    const immediateContent = page
      .getByText(UI_LABELS.auth.guestButton)
      .or(page.getByText(UI_LABELS.tabs.schedule))
      .first();
    await expect(immediateContent).toBeVisible({ timeout: 1000 });

    const hasSplashTestId = await page
      .locator('[data-testid="intro-splash"]')
      .isVisible()
      .catch(() => false);
    expect(hasSplashTestId).toBe(false);
  });

  test('T1-F1-05: Clicking "Посмотреть интро" in Customization replays the splash overlay on demand', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'guest', skipSplash: true });
    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const replayBtn = page
      .getByRole('button', { name: UI_LABELS.customization.replayIntro })
      .or(page.getByText(UI_LABELS.customization.replayIntro))
      .first();

    await replayBtn.scrollIntoViewIfNeeded();
    await expect(replayBtn).toBeVisible({ timeout: 5000 });
    await replayBtn.click();

    await page.waitForTimeout(150);

    const splashActive = await page.evaluate(() => {
      const explicit = document.querySelector<HTMLElement>(
        '[data-testid="intro-splash"], [aria-label*="интро" i], [aria-label*="splash" i]',
      );
      if (explicit) {
        const r = explicit.getBoundingClientRect();
        return r.width >= 380 && r.height >= 800;
      }
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.some((c) => {
        const r = c.getBoundingClientRect();
        return r.width >= 380 && r.height >= 800;
      });
    });

    expect(splashActive).toBe(true);

    // Tap to skip replay and verify return to app UI
    await page.mouse.click(195, 422);
    await expect(
      page
        .getByText(UI_LABELS.customization.replayIntro)
        .or(page.getByText(UI_LABELS.tabs.profile))
        .first(),
    ).toBeVisible({ timeout: 2000 });
  });
});
