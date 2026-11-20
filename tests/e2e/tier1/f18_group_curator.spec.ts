import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { GROUP_INFO_HEADMAN, UI_LABELS } from '../fixtures/testData';

test.describe('F18: Group & Curator (Tier 1)', () => {
  test('T1-F18-01: Group screen displays Curator card with FIO, position, formatted tel link, and mailto link', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    const curator = GROUP_INFO_HEADMAN.studentGroupCuratorDto!;
    await expect(page.getByText(curator.fio).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(curator.position).first()).toBeVisible();

    await expect(page.getByText('+375 (29) 123-45-67').first()).toBeVisible();
    await expect(page.getByText(curator.email).first()).toBeVisible();

    const telLink = page.locator('a[href^="tel:"]').first();
    const mailtoLink = page.locator(`a[href="mailto:${curator.email}"]`).first();
    await expect(telLink).toBeVisible();
    await expect(mailtoLink).toBeVisible();

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F18-02: Student roster lists all group members with index numbers and total count', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    await expect(page.getByText('Студентов в группе: 8').first()).toBeVisible({
      timeout: 5000,
    });

    for (const student of GROUP_INFO_HEADMAN.groupInfoStudentDto) {
      await expect(page.getByText(student.fio).first()).toBeVisible();
    }
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('8', { exact: true }).first()).toBeVisible();
  });

  test('T1-F18-03: Current user has ВЫ badge and role badges render cleanly', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    await expect(page.getByText(UI_LABELS.profile.meBadge, { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });

    const roles = ['Староста', 'Зам. старосты', 'Спорторг', 'Культорг', 'Профорг', 'БРСМ'];
    for (const role of roles) {
      await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    }

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F18-04: Search input filters student roster by FIO and role', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({
      timeout: 5000,
    });

    const searchInput = page.getByPlaceholder('Поиск').first();
    await searchInput.fill('Волкова');
    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible();
    await expect(page.getByText('Морозов Никита Сергеевич')).toHaveCount(0);

    await searchInput.fill('Спорторг');
    await expect(page.getByText('Громов Артём Иванович').first()).toBeVisible();
    await expect(page.getByText('Волкова Мария Андреевна')).toHaveCount(0);
  });

  test('T1-F18-05: Fallback endpoints populate roster when primary user-group-info returns empty', async ({
    page,
    harnessErrors,
  }) => {
    harnessErrors.allowConsoleErrors();
    const { api } = await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          groupInfo: { studentGroupCuratorDto: null, groupInfoStudentDto: [] },
        },
      },
    });
    await openProfileSubScreen(page, UI_LABELS.profile.group);

    await expect(page.getByText('Волкова Мария Андреевна').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Морозов Никита Сергеевич').first()).toBeVisible();

    const fallbackCalled =
      (api?.getRequestsMatching('/grade-book/group-students') ?? []).length > 0 ||
      (api?.getRequestsMatching('/rating/group') ?? []).length > 0;
    expect(fallbackCalled).toBe(true);
  });
});
