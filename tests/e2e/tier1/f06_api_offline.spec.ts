import {
  test,
  expect,
  bootApp,
  openTab,
  openProfileSubScreen,
} from '../fixtures/appHarness';
import { GROUP_SCHEDULES, PERSONAL_CV, UI_LABELS } from '../fixtures/testData';

test.describe('F6: BSUIR/IIS API Client & Offline/Mock Mode', () => {
  test('T1-F6-01: Live mocked /api/v1/schedule?studentGroup=510902 populates Schedule screen lessons accurately', async ({
    page,
  }) => {
    const customSchedule = structuredClone(GROUP_SCHEDULES['510902']);
    customSchedule.schedules!['Четверг']![0] = {
      ...customSchedule.schedules!['Четверг']![0],
      subject: 'ТАЭВМ',
      subjectFullName: 'Теория архитектуры ЭВМ',
      auditories: ['999-1'],
    };

    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
      api: {
        payloadOverrides: {
          groupSchedules: {
            ...GROUP_SCHEDULES,
            '510902': customSchedule,
          },
        },
      },
    });

    await expect(page.getByText('ТАЭВМ').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('999-1').first()).toBeVisible({ timeout: 5000 });

    const reqs = api!.getRequestsMatching(/\/schedule(\?|$)/);
    expect(reqs.some((r) => r.url.includes('510902'))).toBe(true);
  });

  test('T1-F6-02: Live mocked /api/v1/auth/login + /profiles/personal-cv populates authenticated user FIO, group, and cabinet', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'authenticated',
    });

    const loginReqs = api!.getRequestsMatching('/auth/login');
    expect(loginReqs.length).toBeGreaterThanOrEqual(1);
    expect(loginReqs[0].method).toBe('POST');

    const cvReqs = api!.getRequestsMatching('/profiles/personal-cv');
    expect(cvReqs.length).toBeGreaterThanOrEqual(1);

    await openTab(page, UI_LABELS.tabs.profile);
    await expect(page.getByText(PERSONAL_CV.fio).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(new RegExp(PERSONAL_CV.group)).first()).toBeVisible({ timeout: 5000 });
  });

  test('T1-F6-03: Network failure (route.abort) triggers automatic Offline/Mock fallback with realistic data and no crash', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();

    await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
      api: { abortAll: true },
    });

    // Offline/mock fallback renders realistic BSUIR lessons cleanly
    await expect(
      page.getByText(/ОАиП|ИИиМО|АиСД/i).first(),
    ).toBeVisible({ timeout: 7000 });
    await expect(page.getByText(/учебная неделя/i).first()).toBeVisible();
  });

  test('T1-F6-04: Runtime API Base URL override in Customization directs subsequent API requests to configured URL', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
      api: {
        extraUrlPatterns: ['https://custom-proxy.bsuir.test/**'],
      },
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const apiInput = page
      .getByPlaceholder(/https?:\/\/|api/i)
      .or(page.getByLabel(/API|Base URL|Сервер/i))
      .first();
    await apiInput.scrollIntoViewIfNeeded();
    await expect(apiInput).toBeVisible({ timeout: 5000 });

    await apiInput.fill('https://custom-proxy.bsuir.test/api/v1');
    const saveApiBtn = page
      .getByRole('button', { name: /Сохранить|Применить/i })
      .first();
    if (await saveApiBtn.isVisible().catch(() => false)) {
      await saveApiBtn.click();
    } else {
      await apiInput.press('Enter').catch(() => {});
    }

    api!.clearRequests();
    await openTab(page, UI_LABELS.tabs.schedule);

    // Trigger schedule fetch by pulling down or switching group
    await page.getByText('510902', { exact: false }).first().click();
    const searchInput = page.getByPlaceholder(/групп|преподавател/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('310101');
      await page.getByText('310101', { exact: false }).last().click();
    }

    await page.waitForTimeout(400);
    const customReqs = api!.getRequestsMatching('custom-proxy.bsuir.test');
    expect(customReqs.length).toBeGreaterThanOrEqual(1);
  });

  test('T1-F6-05: Explicit Offline Mode toggle forces mock data usage without issuing live network requests', async ({
    page,
  }) => {
    const { api } = await bootApp(page, {
      mode: 'guest',
      clockDate: '2026-11-19T08:00:00',
    });

    await openProfileSubScreen(page, UI_LABELS.profile.customization);

    const offlineSwitch = page
      .getByRole('switch', { name: /Оффлайн|Автономн/i })
      .or(
        page
          .getByText(/Оффлайн|Автономный режим/i)
          .first()
          .locator('..')
          .locator('input[type="checkbox"], [role="switch"], button'),
      )
      .first();
    await offlineSwitch.scrollIntoViewIfNeeded();
    await expect(offlineSwitch).toBeVisible({ timeout: 5000 });
    await offlineSwitch.click();

    api!.clearRequests();

    await openTab(page, UI_LABELS.tabs.schedule);
    await page.getByText('510902', { exact: false }).first().click();
    const searchInput = page.getByPlaceholder(/групп|преподавател/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('310101');
      await page.getByText('310101', { exact: false }).last().click();
    }

    await page.waitForTimeout(400);
    expect(api!.getRequestsMatching(/\/schedule|iis\.bsuir\.by/).length).toBe(0);
    await expect(page.getByText(/ИИиМО|ОАиП/i).first()).toBeVisible({ timeout: 5000 });
  });
});
