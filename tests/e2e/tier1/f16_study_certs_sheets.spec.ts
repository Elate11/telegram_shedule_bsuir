import {
  test,
  expect,
  bootApp,
  openProfileSubScreen,
  checkNoHorizontalOverflow,
} from '../fixtures/appHarness';
import { CERTIFICATES, MARK_SHEETS, UI_LABELS } from '../fixtures/testData';

test.describe('F16: Study — Certificates & Mark Sheets (Tier 1)', () => {
  test('T1-F16-01: Study screen renders Справки and Ведомости tabs and switches between them', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    const certsTab = page.getByText(/Справки/i).first();
    const sheetsTab = page.getByText(/Ведомости/i).first();
    await expect(certsTab).toBeVisible({ timeout: 5000 });
    await expect(sheetsTab).toBeVisible();

    await expect(page.getByText(CERTIFICATES[0].provisionPlace).first()).toBeVisible();

    await sheetsTab.click();
    await expect(page.getByText(MARK_SHEETS[0].number).first()).toBeVisible({
      timeout: 5000,
    });

    const overflow = await checkNoHorizontalOverflow(page);
    expect(overflow.ok).toBe(true);
  });

  test('T1-F16-02: Certificates tab displays status badges and rejection reason', async ({
    page,
  }) => {
    await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await expect(
      page.getByText(UI_LABELS.studyAndOrvi.statusPrinted).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(UI_LABELS.studyAndOrvi.statusPending).first(),
    ).toBeVisible();
    await expect(
      page.getByText(UI_LABELS.studyAndOrvi.statusRejected).first(),
    ).toBeVisible();
    await expect(
      page.getByText(CERTIFICATES[2].rejectionReason!).first(),
    ).toBeVisible();
  });

  test('T1-F16-03: Order certificate submits POST /certificate/register and pending certificate can be cancelled', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await page.getByText(UI_LABELS.studyAndOrvi.orderCertificate).first().click();
    await expect(page.getByText(/Заказ справки/i).first()).toBeVisible({
      timeout: 5000,
    });

    const customPlaceInput = page
      .getByPlaceholder(/по месту работы|укажите сво[её] место/i)
      .or(page.locator('input[type="text"]'))
      .first();
    await customPlaceInput.fill('В банк для кредита');

    await page.getByText(/Гербовая/i).first().click();
    await page.getByText('2', { exact: true }).first().click();

    await page.getByRole('button', { name: /^Заказать$/i })
      .or(page.getByText('Заказать', { exact: true }))
      .last()
      .click();

    await expect
      .poll(() =>
        (api?.getRequestsMatching('/certificate/register') ?? []).filter(
          (r) => r.method === 'POST',
        ).length,
      )
      .toBeGreaterThanOrEqual(1);

    const regReq = api?.getRequestsMatching('/certificate/register').find((r) => r.method === 'POST');
    const body = JSON.parse(regReq?.postData ?? '{}') as {
      certificateCount?: number;
      certificateRequestDto?: { certificateType?: string; provisionPlace?: string };
    };
    expect(body.certificateCount).toBe(2);
    expect(body.certificateRequestDto?.certificateType).toMatch(/гербовая/i);
    expect(body.certificateRequestDto?.provisionPlace).toBe('В банк для кредита');

    await expect(page.getByText('В банк для кредита').first()).toBeVisible({
      timeout: 5000,
    });

    // Cancel a pending request
    const cancelBtn = page.getByText(UI_LABELS.studyAndOrvi.cancelRequest).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect
      .poll(() => (api?.getRequestsMatching('/certificate/close') ?? []).length)
      .toBeGreaterThanOrEqual(1);
  });

  test('T1-F16-04: Mark Sheets tab renders existing sheets and orders new unexcused sheet with 5.75 BYN/h price', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await page.getByText(/Ведомости/i).first().click();
    await expect(page.getByText(MARK_SHEETS[0].number).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/23[.,]00?\s*BYN/).first()).toBeVisible();

    await page.getByText(UI_LABELS.studyAndOrvi.orderMarkSheet).first().click();
    await expect(page.getByText(/Заказ ведомости/i).first()).toBeVisible({
      timeout: 5000,
    });

    await page.getByText('ОАиП', { exact: true }).last().click();
    await page.getByText('ЛР', { exact: true }).last().click();
    await page.getByText('4 ч', { exact: true }).first().click();

    // Toggle "Уважительная причина" off -> price becomes 4 * 5.75 = 23.00 BYN
    const reasonRow = page.getByText('Уважительная причина').first();
    const reasonSwitch = page
      .getByRole('switch')
      .or(page.locator('input[type="checkbox"]'))
      .first();
    if (await reasonSwitch.isVisible().catch(() => false)) {
      await reasonSwitch.click();
    } else {
      await reasonRow.click();
    }

    await page.getByRole('button', { name: /^Заказать$/i })
      .or(page.getByText('Заказать', { exact: true }))
      .last()
      .click();

    await expect
      .poll(() =>
        (api?.getRequestsMatching('/mark-sheet') ?? []).filter(
          (r) => r.method === 'POST',
        ).length,
      )
      .toBeGreaterThanOrEqual(1);

    const postReq = api
      ?.getRequestsMatching('/mark-sheet')
      .find((r) => r.method === 'POST');
    const payload = JSON.parse(postReq?.postData ?? '{}') as {
      price?: number;
      reason?: boolean;
      hours?: string | number;
    };
    expect(Number(payload.hours)).toBe(4);
    expect(payload.reason).toBe(false);
    expect(payload.price).toBeCloseTo(23, 1);
  });

  test('T1-F16-05: Pending mark sheet can be withdrawn via Отозвать заявку (GET /mark-sheet/close)', async ({
    page,
  }) => {
    const { api } = await bootApp(page, { mode: 'authenticated' });
    await openProfileSubScreen(page, UI_LABELS.profile.study);

    await page.getByText(/Ведомости/i).first().click();
    await expect(page.getByText(MARK_SHEETS[0].number).first()).toBeVisible({
      timeout: 5000,
    });

    const withdrawBtn = page
      .getByText(UI_LABELS.studyAndOrvi.withdrawMarkSheet)
      .first();
    await expect(withdrawBtn).toBeVisible();
    await withdrawBtn.click();

    await expect
      .poll(() => (api?.getRequestsMatching('/mark-sheet/close') ?? []).length)
      .toBeGreaterThanOrEqual(1);

    const closeReq = api?.getRequestsMatching('/mark-sheet/close')[0];
    expect(closeReq?.url).toContain(`id=${MARK_SHEETS[0].id}`);
    await expect(page.getByText(MARK_SHEETS[0].number)).toHaveCount(0);
  });
});
