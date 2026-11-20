import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import {
  ANNOUNCEMENTS,
  DORMITORY_APPLICATIONS,
  DORMITORY_PRIVILEGES,
  PENALTIES,
  UI_LABELS,
} from '../fixtures/testData';

test.describe('F20: Dormitory, Privileges, Penalties & Announcements (Tier 1)', () => {
  test('T1-F20-01: Dormitory Заявки tab displays queue number, status, room info, and DD.MM.YYYY dates', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.dormitory);

    const app0 = DORMITORY_APPLICATIONS[0];
    await expect(page.getByText(/Заявки/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(new RegExp(String(app0.numberInQueue))).first()).toBeVisible();
    await expect(page.getByText(app0.status).first()).toBeVisible();
    await expect(page.getByText(app0.roomInfo!).first()).toBeVisible();
    // 2026-06-15 formatted as DD.MM.YYYY -> 15.06.2026
    await expect(page.getByText(/15\.06\.2026|2026-06-15/).first()).toBeVisible();

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F20-02: Dormitory Льготы tab (and direct Profile Льготы entry) displays privilege category, year, name, and note', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.privileges);

    const priv = DORMITORY_PRIVILEGES[0];
    await expect(
      page.getByText(priv.dormitoryPrivilegeCategoryName).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(new RegExp(String(priv.year))).first()).toBeVisible();
    await expect(page.getByText(priv.dormitoryPrivilegeName).first()).toBeVisible();
    await expect(page.getByText(new RegExp(priv.note!)).first()).toBeVisible();
  });

  test('T1-F20-03: Penalties & Incentives screen displays directives from /premium-penalty', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.penalties);

    const pen = PENALTIES[0];
    await expect(page.getByText(pen.directiveDto.typeName).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(pen.directiveDto.date).first()).toBeVisible();
    await expect(page.getByText(new RegExp(pen.directiveDto.number)).first()).toBeVisible();
    await expect(page.getByText(pen.reason).first()).toBeVisible();
  });

  test('T1-F20-04: Announcements screen displays BSUIR feed items from /announcements', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.announcements);

    await expect(page.getByText(ANNOUNCEMENTS[0].title).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(ANNOUNCEMENTS[0].content).first()).toBeVisible();
    await expect(page.getByText(ANNOUNCEMENTS[0].date).first()).toBeVisible();
    await expect(page.getByText(ANNOUNCEMENTS[1].title).first()).toBeVisible();

    expect((api?.getRequestsMatching('/announcements') ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('T1-F20-05: Empty-list responses for Dormitory, Privileges, Penalties, and Announcements render clean Russian empty states', async ({
    page,
  }) => {
    await bootApp(page, {
      mode: 'authenticated',
      api: {
        payloadOverrides: {
          dormitoryQueue: [],
          dormitoryPrivileges: [],
          penalties: [],
          announcements: [],
        },
      },
    });

    const goBack = async () => {
      const backBtn = page
        .getByRole('button', { name: /Назад/i })
        .or(page.getByLabel(/Назад/i))
        .or(page.locator('[aria-label*="Назад" i], [data-testid="back-button"]'))
        .first();
      await backBtn.click();
    };

    await openProfileSubScreen(page, UI_LABELS.profile.dormitory);
    await expect(page.getByText(UI_LABELS.emptyStates.noDormitory).first()).toBeVisible({
      timeout: 5000,
    });
    await goBack();

    await openProfileSubScreen(page, UI_LABELS.profile.privileges);
    await expect(page.getByText(UI_LABELS.emptyStates.noPrivileges).first()).toBeVisible({
      timeout: 5000,
    });
    await goBack();

    await openProfileSubScreen(page, UI_LABELS.profile.penalties);
    await expect(page.getByText(UI_LABELS.emptyStates.noPenalties).first()).toBeVisible({
      timeout: 5000,
    });
    await goBack();

    await openProfileSubScreen(page, UI_LABELS.profile.announcements);
    await expect(page.getByText(/пока нет объявлений/i).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
