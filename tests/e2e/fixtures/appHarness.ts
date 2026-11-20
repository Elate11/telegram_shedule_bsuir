import {
  test as base,
  expect,
  type Page,
  type Locator,
} from '@playwright/test';
import {
  installApiMock,
  type ApiMockController,
  type ApiMockOptions,
} from './apiMock';
import {
  installTelegramMock,
  type TelegramMockOptions,
} from './telegramMock';
import { AUTH_CREDENTIALS, UI_LABELS } from './testData';

export type TabName = 'Расписание' | 'Оценки' | 'Заметки' | 'Профиль';

export interface HarnessErrorGuard {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  allowConsoleErrors(patterns?: Array<string | RegExp>): void;
}

export interface BootAppOptions {
  telegram?: TelegramMockOptions | false;
  api?: ApiMockOptions | false;
  clockDate?: Date | string | number;
  skipSplash?: boolean;
  mode?: 'raw' | 'guest' | 'authenticated';
  credentials?: { username: string; password: string };
  path?: string;
}

export interface BootAppResult {
  api: ApiMockController | null;
}

export interface OverflowCheckResult {
  ok: boolean;
  scrollWidth: number;
  clientWidth: number;
}

const DEFAULT_ALLOWED_FAULT_CONSOLE_PATTERNS: RegExp[] = [
  /Failed to load resource/i,
  /net::ERR_FAILED/i,
  /status of (401|403|404|409|500|502|503)/i,
  /AbortError/i,
  /NetworkError/i,
];

function isErrorAllowed(
  message: string,
  allowedPatterns: Array<string | RegExp>,
): boolean {
  return allowedPatterns.some((pattern) =>
    typeof pattern === 'string'
      ? message.includes(pattern)
      : pattern.test(message),
  );
}

export const test = base.extend<{
  harnessErrors: HarnessErrorGuard;
}>({
  harnessErrors: [
    async ({ page }, use) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const allowedConsolePatterns: Array<string | RegExp> = [];

      const onPageError = (err: Error) => {
        pageErrors.push(err.stack ?? err.message);
      };

      const onConsole = (msg: { type: () => string; text: () => string }) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      };

      page.on('pageerror', onPageError);
      page.on('console', onConsole);

      await use({
        pageErrors,
        consoleErrors,
        allowConsoleErrors(patterns?: Array<string | RegExp>) {
          if (!patterns || patterns.length === 0) {
            allowedConsolePatterns.push(...DEFAULT_ALLOWED_FAULT_CONSOLE_PATTERNS);
          } else {
            allowedConsolePatterns.push(...patterns);
          }
        },
      });

      page.off('pageerror', onPageError);
      page.off('console', onConsole);

      expect(
        pageErrors,
        `Uncaught pageerror(s) detected: ${pageErrors.join(' | ')}`,
      ).toEqual([]);

      const unexpectedConsoleErrors = consoleErrors.filter(
        (msg) => !isErrorAllowed(msg, allowedConsolePatterns),
      );
      expect(
        unexpectedConsoleErrors,
        `Unexpected console.error(s) detected: ${unexpectedConsoleErrors.join(' | ')}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function freezeClock(
  page: Page,
  dateOrIso: Date | string | number,
): Promise<void> {
  await page.clock.setFixedTime(dateOrIso);
}

export async function skipSplashIfVisible(page: Page): Promise<void> {
  const mainOrAuthVisible = page
    .getByRole('button', { name: UI_LABELS.auth.loginButton })
    .or(page.getByText(UI_LABELS.auth.guestButton))
    .or(page.getByText(UI_LABELS.tabs.schedule))
    .first();

  // Wait briefly for initial render
  await page.waitForTimeout(150);

  const splashLocator = page
    .locator('[data-testid="intro-splash"], [aria-label*="интро" i], [aria-label*="splash" i]')
    .first();

  const hasExplicitSplash = await splashLocator.isVisible().catch(() => false);
  if (hasExplicitSplash) {
    await splashLocator.click({ force: true }).catch(() => {});
    await splashLocator.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    return;
  }

  const alreadyAtMain = await mainOrAuthVisible.isVisible().catch(() => false);
  if (!alreadyAtMain) {
    // Splash canvas covers 390x844; tap center to skip
    await page.mouse.click(195, 422);
    await page.waitForTimeout(250);
    // In case a second frame/fade requires one more tap or short settle
    const nowVisible = await mainOrAuthVisible.isVisible().catch(() => false);
    if (!nowVisible) {
      await page.mouse.click(195, 422);
      await mainOrAuthVisible.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
  }
}

export async function enterGuestMode(page: Page): Promise<void> {
  const guestBtn = page
    .getByRole('button', { name: UI_LABELS.auth.guestButton })
    .or(page.getByText(UI_LABELS.auth.guestButton))
    .first();

  if (await guestBtn.isVisible().catch(() => false)) {
    await guestBtn.click();
  }

  await expect(
    page
      .getByText(UI_LABELS.tabs.schedule)
      .or(page.getByText(/учебная неделя/i))
      .or(page.getByPlaceholder(/групп|поиск|преподавател/i))
      .first(),
  ).toBeVisible({ timeout: 5000 });
}

export async function loginAsStudent(
  page: Page,
  credentials?: { username?: string; password?: string },
): Promise<void> {
  const username = credentials?.username ?? AUTH_CREDENTIALS.validUser;
  const password = credentials?.password ?? AUTH_CREDENTIALS.validPass;

  const gradebookInput = page
    .getByPlaceholder(UI_LABELS.auth.gradebookPlaceholder)
    .or(page.getByLabel(UI_LABELS.auth.gradebookPlaceholder))
    .first();

  const passwordInput = page
    .getByPlaceholder(UI_LABELS.auth.passwordPlaceholder)
    .or(page.getByLabel(UI_LABELS.auth.passwordPlaceholder))
    .first();

  await expect(gradebookInput).toBeVisible({ timeout: 5000 });
  await gradebookInput.fill(username);
  await passwordInput.fill(password);

  const loginBtn = page
    .getByRole('button', { name: UI_LABELS.auth.loginButton, exact: true })
    .or(page.getByRole('button', { name: new RegExp(`^${UI_LABELS.auth.loginButton}$`, 'i') }))
    .first();
  await loginBtn.click();

  await expect(
    page.getByText(UI_LABELS.tabs.schedule).first(),
  ).toBeVisible({ timeout: 5000 });
}

export async function openTab(page: Page, tabName: TabName): Promise<void> {
  const bottomNavCandidates: Locator = page
    .locator('nav, [role="tablist"], [data-testid="bottom-nav"]')
    .getByText(tabName, { exact: true })
    .or(page.getByRole('tab', { name: tabName }))
    .or(page.getByRole('button', { name: tabName, exact: true }));

  const directBtn = bottomNavCandidates.first();
  if (await directBtn.isVisible().catch(() => false)) {
    await directBtn.click();
    return;
  }

  // Fallback for Hold navigation mode: press & hold >=480ms to summon AppleRadialMenu
  await page.mouse.move(195, 422);
  await page.mouse.down();
  await page.waitForTimeout(560);
  await page.mouse.up();

  const radialItem = page.getByText(tabName, { exact: true }).last();
  await expect(radialItem).toBeVisible({ timeout: 3000 });
  await radialItem.click();
}

export async function openProfileSubScreen(
  page: Page,
  label: string | RegExp,
): Promise<void> {
  await openTab(page, UI_LABELS.tabs.profile);

  const item =
    typeof label === 'string'
      ? page.getByText(label, { exact: false }).first()
      : page.getByText(label).first();

  await item.scrollIntoViewIfNeeded().catch(() => {});
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
}

export async function checkNoHorizontalOverflow(
  page: Page,
  maxWidth = 390,
): Promise<OverflowCheckResult> {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  return {
    ok: dims.scrollWidth <= maxWidth,
    scrollWidth: dims.scrollWidth,
    clientWidth: dims.clientWidth,
  };
}

export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore if origin not ready
    }
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

export async function bootApp(
  page: Page,
  options: BootAppOptions = {},
): Promise<BootAppResult> {
  if (options.clockDate !== undefined) {
    await freezeClock(page, options.clockDate);
  }

  if (options.telegram !== false) {
    await installTelegramMock(page, options.telegram ?? { mode: 'full' });
  }

  let api: ApiMockController | null = null;
  if (options.api !== false) {
    api = await installApiMock(page, options.api ?? {});
  }

  await page.goto(options.path ?? '/');

  if (options.skipSplash !== false) {
    await skipSplashIfVisible(page);
  }

  if (options.mode === 'guest') {
    await enterGuestMode(page);
  } else if (options.mode === 'authenticated') {
    await loginAsStudent(page, options.credentials);
  }

  return { api };
}
