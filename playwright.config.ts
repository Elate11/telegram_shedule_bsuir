import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const HEADLESS_SHELL_1228 =
  '/Users/aleksandr/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const CHROMIUM_1228 =
  '/Users/aleksandr/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

function resolveChromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const headed = process.argv.includes('--headed');
  const preferred = headed ? CHROMIUM_1228 : HEADLESS_SHELL_1228;
  if (fs.existsSync(preferred)) return preferred;
  if (fs.existsSync(CHROMIUM_1228)) return CHROMIUM_1228;
  if (fs.existsSync(HEADLESS_SHELL_1228)) return HEADLESS_SHELL_1228;
  return undefined;
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: resolveChromiumExecutable(),
    },
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
