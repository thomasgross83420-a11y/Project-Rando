import { expect, type Page, test } from '@playwright/test';
import { battleTools, prepMenu } from './menu-helpers';

async function takeOver(page: Page) {
  await expect(page.getByRole('button', { name: 'Load Campaign', exact: true })).toBeVisible();
  const take = page.getByRole('button', { name: 'Take Over Editing', exact: true });
  if (await take.isVisible()) {
    await take.click();
    await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  }
}
async function newCampaign(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.locator('#name').fill('Paid progression');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#campaign-heading')).toHaveText('Paid progression');
}
async function enable(page: Page) {
  await prepMenu(page, 'siege');
  await page.locator('#campaign-siege').click();
  await page.locator('#enable-progression').click();
  await expect(page.locator('#campaign-begin')).toBeVisible();
  await page.locator('#campaign-formation').click();
  await page.locator('#battle-confirm').click();
  await expect(page.locator('#campaign-begin')).toBeEnabled();
}
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('resonance-bastion-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const c = await new Promise<{
      credits: number;
      assets: { hp: number; enhancement: number; enhancementPaid: number; xp: number }[];
    }>((resolve, reject) => {
      const tx = db.transaction('campaigns'),
        request = tx.objectStore('campaigns').get(0);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return c;
  });
}
async function waitForCampaignResult(page: Page, pending = false) {
  let performanceResumes = 0;
  await expect
    .poll(
      async () => {
        if (
          pending
            ? await page.locator('#campaign-finalize').isVisible()
            : (await page.locator('#battle-content').textContent())?.includes(
                'Campaign Results Saved',
              )
        )
          return true;
        if ((await page.locator('#battle-pause').textContent()) === 'Resume…') {
          await expect(page.locator('#battle-status')).toContainText('Paused: performance');
          await battleTools(page);
          await page.locator('#battle-speed').selectOption('2');
          await page.locator('#battle-pause').click();
          await page.locator('#battle-resume').click();
          performanceResumes++;
        }
        return false;
      },
      { timeout: 120000, intervals: [250] },
    )
    .toBe(true);
  await test.info().attach('performance-policy', {
    body: JSON.stringify({ performanceResumes }),
    contentType: 'application/json',
  });
}

test('the player can migrate, deploy existing assets, win, review committed XP and rearm the persisted mine once', async ({
  page,
}) => {
  test.setTimeout(180000);
  await newCampaign(page);
  await enable(page);
  await page.locator('#campaign-begin').click();
  await battleTools(page);
  await expect(page.locator('#battle-speed')).toBeVisible();
  await battleTools(page);
  await page.locator('#battle-speed').selectOption('4');
  await expect(page.locator('#battle-time')).toContainText('4×');
  await waitForCampaignResult(page);
  await expect(page.locator('#battle-content')).toContainText('Bastion XP +286');
  await expect(page.locator('#battle-content')).toContainText('Rank 1 → 2');
  await expect(page.locator('#battle-content')).toContainText('Warden survives; Core at least 75%');
  await expect(page.locator('#battle-content')).toContainText('No recovery purchase has been made');
  await page
    .locator('#battle-content')
    .screenshot({ path: 'test-results/campaign-victory-summary.png' });
  await page.locator('#campaign-finish').click();
  await expect(page.locator('#account')).toContainText('Rank 2');
  await prepMenu(page, 'build');
  await page
    .locator('[data-owned]')
    .filter({ hasText: 'Proximity Mine' })
    .filter({ hasText: 'at 18,24' })
    .click();
  await expect(page.locator('#progression-controls')).toContainText('0 / 1 permanent charge');
  const before = await saved(page);
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Rearm', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('19 Credits');
  await page.locator('#progression-confirm').dblclick();
  await expect(page.locator('#progression-controls')).toContainText('1 / 1 permanent charge');
  expect((await saved(page)).credits).toBe(before.credits - 19);
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#account')).toContainText('Rank 2');
  await expect(page.locator('#campaign-begin')).toHaveCount(0);
});
test('a visible commit failure preserves the exact result and retry succeeds even if the audio device rejects suspension', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await newCampaign(page);
  await enable(page);
  await page.locator('#campaign-begin').click();
  await battleTools(page);
  await page.locator('#battle-speed').selectOption('4');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (!failed && this.name === 'meta' && key === 'receipts.slot.0') {
        failed = true;
        throw new DOMException('Injected UI receipt failure', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    };
    AudioContext.prototype.suspend = () =>
      Promise.reject(new Error('Injected audio device failure'));
  });
  await waitForCampaignResult(page, true);
  await expect(page.locator('#battle-content')).toContainText('Pending Campaign Results');
  expect((await saved(page)).credits).toBe(600);
  await page.locator('#campaign-finalize').click();
  await expect(page.locator('#battle-content')).toContainText('Campaign Results Saved');
  await expect(page.locator('#battle-content')).toContainText('Bastion XP +286');
  const committed = await saved(page);
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#battle-content')).toContainText('Campaign Results Saved');
  expect(await saved(page)).toEqual(committed);
  await page.locator('#campaign-finish').click();
  expect(errors).toEqual([]);
});
test('earned enhancement preview quotes actual weapon changes and preserves a wreck until explicitly restored', async ({
  page,
}) => {
  await page.goto('./');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(async () => {
    const s = await window.RBRunFixture.productionSetup(),
      c = s.campaign;
    if (c?.schema !== 2) throw new Error('Missing');
    const before = structuredClone(c),
      a = c.assets.find((a) => a.type === 'friendly.sentry');
    if (!a) throw new Error('Missing Sentry');
    a.level = 10;
    a.xp = 1502;
    a.hp = 0;
    c.revision++;
    await s.repo.commit(c, before);
  });
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await prepMenu(page, 'build');
  await page.locator('[data-owned]').filter({ hasText: 'Sentry' }).first().click();
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Enhancement 1', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('100 Credits');
  await expect(page.locator('#dialog-body')).toContainText('damage per release');
  await expect(page.locator('#dialog-body')).toContainText('weapon range');
  await page.locator('#close-dialog').click();
  expect((await saved(page)).credits).toBe(600);
  await prepMenu(page, 'upgrade');
  await page.getByRole('button', { name: 'Review Enhancement 1', exact: true }).click();
  await page.locator('#progression-confirm').dblclick();
  await expect(page.locator('#progression-controls')).toContainText('E1 / 1 eligible');
  const paid = await saved(page),
    grown = paid.assets.find((a) => a.xp === 1502);
  expect(paid.credits).toBe(500);
  expect(grown).toMatchObject({ hp: 0, enhancement: 1, enhancementPaid: 100, xp: 1502 });
  await page.getByRole('button', { name: 'Review Restore', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('105 Credits');
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).not.toContainText('Wrecked');
  expect((await saved(page)).credits).toBe(395);
});
test('reload restarts the captured beginning and abandoning an unfinished siege pays nothing', async ({
  page,
}) => {
  test.setTimeout(60000);
  await newCampaign(page);
  await enable(page);
  await page.locator('#campaign-begin').click();
  await expect(page.locator('#battle-time')).toBeVisible();
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#battle-content')).toContainText('Interrupted Campaign Siege');
  await page.locator('#campaign-restart').click();
  await expect(page.locator('#battle-time')).toBeVisible();
  await page.locator('#battle-pause').click();
  await page.locator('#battle-title').click();
  await page.locator('#battle-confirm').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('#campaign-abandon').click();
  await page.locator('#battle-confirm').click();
  await expect(page.locator('#account')).toContainText('Rank 1');
  await expect(page.locator('#account')).toContainText('600 Credits');
});
test('the recovery controls preserve a cash-poor wrecked campaign and explicitly commit its emergency repair outside Undo', async ({
  page,
}) => {
  await page.goto('./');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(async () => {
    const s = await window.RBRunFixture.productionSetup(),
      c = s.campaign;
    if (c?.schema !== 2) throw new Error('Missing');
    const before = structuredClone(c);
    c.credits = 0;
    c.coreHP = 0;
    c.revision++;
    for (const a of c.assets) a.hp = 0;
    await s.repo.commit(c, before);
  });
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await prepMenu(page, 'upgrade');
  await expect(page.getByRole('button', { name: 'Review Recovery', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review Recovery', exact: true }).click();
  await expect(page.locator('#dialog-body')).toContainText('2,500 Integrity');
  await page.locator('#close-dialog').click();
  await expect(page.locator('#progression-controls')).toContainText('Core 0');
  await page.getByRole('button', { name: 'Review Recovery', exact: true }).click();
  await page.locator('#progression-confirm').click();
  await expect(page.locator('#progression-controls')).toContainText('2,500');
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Review Recovery', exact: true })).toHaveCount(0);
});
test('progression controls and quoted purchases reflow in portrait and landscape at normal and 200% interface scale', async ({
  page,
}) => {
  await page.goto('./');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(() => window.RBRunFixture.productionSetup());
  await page.reload();
  await takeOver(page);
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await prepMenu(page, 'build');
  await page.locator('[data-owned]').filter({ hasText: 'Sentry' }).first().click();
  for (const viewport of [
    { width: 412, height: 915 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    for (const scale of ['18', '36']) {
      await prepMenu(page, 'tools');
      await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
      await page.getByLabel('Interface scale').selectOption(scale);
      await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
      await prepMenu(page, 'upgrade');
      await page.locator('#progression-controls').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const box = await page
        .locator('#progression-controls')
        .evaluate((e) => ({ scroll: e.scrollWidth, width: e.clientWidth }));
      expect(box.scroll).toBeLessThanOrEqual(box.width);
      await page.screenshot({
        path: `test-results/progression-${viewport.width}-${scale}.png`,
        fullPage: true,
      });
    }
  }
});
