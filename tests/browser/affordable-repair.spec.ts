import { prepMenu } from './menu-helpers';
import { expect, test, type Page } from '@playwright/test';
async function fixture(page: Page, credits: number, coreHP: number, sentryHP: number) {
  await page.goto('./?legacy=1');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(
    async ({ credits, coreHP, sentryHP }) => {
      const s = await window.RBRunFixture.productionSetup(),
        c = s.campaign;
      if (c?.schema !== 2) throw new Error('Missing');
      const before = structuredClone(c),
        a = c.assets.find((a) => a.type === 'friendly.sentry');
      if (!a) throw new Error('Missing Sentry');
      c.credits = credits;
      c.coreHP = coreHP;
      a.hp = sentryHP;
      c.revision++;
      await s.repo.commit(c, before);
    },
    { credits, coreHP, sentryHP },
  );
  await page.reload();
  const take = page.getByRole('button', { name: 'Take Over Editing', exact: true });
  await expect(page.getByRole('button', { name: 'Load Campaign', exact: true })).toBeVisible();
  if (await take.isVisible()) {
    await take.click();
    await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
}
async function saved(page: Page) {
  // Read without taking over the application's writer lease.
  return page.evaluate(async () => {
    const request = indexedDB.open('resonance-bastion-v1', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const c = await new Promise<{
      credits: number;
      coreHP: number;
      assets: { type: string; hp: number; xp: number }[];
    }>((resolve, reject) => {
      const r = db.transaction('campaigns').objectStore('campaigns').get(0);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return c;
  });
}
test('unaffordable full repair is preserved; affordable Core preview can cancel, then explicitly spend once', async ({
  page,
}) => {
  await fixture(page, 7, 9000 * 1024, 1200 * 1024);
  const before = await saved(page);
  await expect(page.locator('#progression-controls')).toContainText('70 points for 7 Credits');
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Core Repair', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Insufficient Credits');
  expect(await saved(page)).toEqual(before);
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Affordable Core Repair', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('9,000 → 9,070');
  await page
    .getByRole('dialog')
    .screenshot({ path: 'test-results/affordable-core-repair-quote.png' });
  await page.locator('#close-dialog').click();
  expect(await saved(page)).toEqual(before);
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Affordable Core Repair', exact: true }).click();
  await page.locator('#progression-confirm').dblclick();
  await expect(page.locator('#progression-controls')).toContainText('Core 9,070');
  expect(await saved(page)).toMatchObject({ credits: 0, coreHP: 9070 * 1024 });
  await prepMenu(page, 'upgrade');
  await expect(
    page.getByRole('button', { name: 'Review Affordable Core Repair', exact: true }),
  ).toBeDisabled();
});
test('quarter, half and exact asset choices use max body, cap at missing body and preserve earned XP', async ({
  page,
}) => {
  await fixture(page, 600, 10000 * 1024, 600 * 1024);
  await prepMenu(page, 'build');
  await page.locator('[data-owned]').filter({ hasText: 'Sentry' }).first().click();
  await prepMenu(page, 'upgrade');
  await page.locator('#asset-repair-mode').selectOption('quarter');
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Asset Repair', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('16 Credits');
  await expect(page.locator('#dialog-body')).toContainText('600 → 900');
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).toContainText('900 / 1,200');
  await prepMenu(page, 'upgrade');
  await page.locator('#asset-repair-mode').selectOption('exact');
  await prepMenu(page, 'upgrade');
  await page.locator('#asset-repair-points').fill('10');
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Asset Repair', exact: true }).click();
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).toContainText('910 / 1,200');
  await prepMenu(page, 'upgrade');
  await page.locator('#asset-repair-mode').selectOption('half');
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Asset Repair', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('910 → 1,200');
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).toContainText('1,200 / 1,200');
  const c = await saved(page);
  expect(c.credits).toBe(567);
  expect(c.assets.find((a) => a.type === 'friendly.sentry')).toMatchObject({
    hp: 1200 * 1024,
    xp: 0,
  });
});
test('a small asset wallet keeps the exact affordable fraction through persistence instead of charging a rounded display', async ({
  page,
}) => {
  await fixture(page, 3, 10000 * 1024, 1000 * 1024);
  await prepMenu(page, 'build');
  await page.locator('[data-owned]').filter({ hasText: 'Sentry' }).first().click();
  await expect(page.locator('#progression-controls')).toContainText('57.6 points for 3 Credits');
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Affordable Asset Repair', exact: true }).click();
  await page
    .getByRole('dialog')
    .screenshot({ path: 'test-results/affordable-asset-repair-quote.png' });
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).toContainText('1,057.6');
  const c = await saved(page);
  expect(c.credits).toBe(0);
  expect(c.assets.find((a) => a.type === 'friendly.sentry')?.hp).toBe(1082982);
});
