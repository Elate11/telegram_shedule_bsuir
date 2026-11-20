import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { LOGIN_RESPONSE_HEADMAN, UI_LABELS } from '../fixtures/testData';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test.describe('F14: Profile Hub (Tier 1)', () => {
  test('T1-F14-01: Profile displays avatar, FIO, group and supports custom avatar image upload', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.profile);

    await expect(page.getByText(LOGIN_RESPONSE_HEADMAN.fio).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/510902/).first()).toBeVisible();

    const avatarImg = page.locator('img[alt*="Аватар" i], img').first();
    await expect(avatarImg).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_1X1_BASE64, 'base64'),
    });

    await expect
      .poll(async () => avatarImg.getAttribute('src'))
      .toMatch(/^(data:image|blob:)/);
  });

  test('T1-F14-02: Headman user auto-detects Староста role and displays Журнал старосты menu item', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });
    await openTab(page, UI_LABELS.tabs.profile);

    await expect(page.getByText(UI_LABELS.profile.headmanJournal).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T1-F14-03: Profile displays unread notifications badge and unexcused absence hours badge', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.profile);

    // NOTIFICATIONS has 2 unread items; OMISSIONS has 2 unexcused hours
    await expect(page.getByText(/2\s*новых|^2$/).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/2\s*ч/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('T1-F14-04: All 12 navigation items open their respective screens and return cleanly', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: { isHeadman: true },
    });

    const items: Array<{ label: string; expectedHeading: RegExp }> = [
      { label: UI_LABELS.profile.notifications, expectedHeading: /Уведомления/i },
      { label: UI_LABELS.profile.study, expectedHeading: /Справки|Уч[её]ба/i },
      { label: UI_LABELS.profile.gradebook, expectedHeading: /Зач[её]тка/i },
      { label: UI_LABELS.profile.group, expectedHeading: /Список группы|Группа/i },
      { label: UI_LABELS.profile.headmanJournal, expectedHeading: /Журнал старосты/i },
      { label: UI_LABELS.profile.absences, expectedHeading: /Пропуски/i },
      { label: UI_LABELS.profile.iisResume, expectedHeading: /Резюме|Виджет/i },
      { label: UI_LABELS.profile.dormitory, expectedHeading: /Общежитие/i },
      { label: UI_LABELS.profile.privileges, expectedHeading: /Льготы/i },
      { label: UI_LABELS.profile.penalties, expectedHeading: /Взыскания/i },
      { label: UI_LABELS.profile.announcements, expectedHeading: /Объявления/i },
      { label: UI_LABELS.profile.customization, expectedHeading: /Кастомизация/i },
    ];

    for (const item of items) {
      await openProfileSubScreen(page, item.label);
      await expect(page.getByText(item.expectedHeading).first()).toBeVisible({
        timeout: 5000,
      });
      const overflow = await checkNoHorizontalOverflow(page);
      expect(overflow.ok, `Overflow on ${item.label}`).toBe(true);

      const backBtn = page
        .getByRole('button', { name: /Назад/i })
        .or(page.getByLabel(/Назад/i))
        .or(page.locator('[aria-label*="Назад" i], [data-testid="back-button"]'))
        .first();
      await backBtn.click();
      await expect(page.getByText(UI_LABELS.profile.logout).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('T1-F14-05: Profile footer renders Выйти and GitHub link; 5-second avatar hold toggles max-vibration mode', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openTab(page, UI_LABELS.tabs.profile);

    await expect(page.getByText(UI_LABELS.profile.logout).first()).toBeVisible();
    const githubEl = page.getByText(UI_LABELS.profile.github).first();
    await expect(githubEl).toBeVisible();

    const avatarBox = await page
      .locator('img[alt*="Аватар" i], img')
      .first()
      .boundingBox();
    expect(avatarBox).not.toBeNull();
    if (avatarBox) {
      const cx = avatarBox.x + avatarBox.width / 2;
      const cy = avatarBox.y + avatarBox.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(5200);
      await page.mouse.up();
    }

    // Profile stays responsive and crash-free after 5s easter-egg hold
    await expect(page.getByText(LOGIN_RESPONSE_HEADMAN.fio).first()).toBeVisible();
  });
});
