import { expect, test, type Page } from '@playwright/test';
async function create(page: Page, name = 'Recovery First') {
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#preparation')).toBeVisible();
}
async function data(page: Page) {
  await page
    .getByRole('button', { name: 'Data Management', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('#data-host')).toBeVisible();
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Prepare Backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup ready', exact: true })).toBeVisible();
  return page.locator('#prepared-backup').inputValue();
}
async function paste(page: Page, text: string) {
  if (!(await page.locator('#backup-text').isVisible()))
    await page.getByText('Paste backup text instead', { exact: true }).click();
  await page.locator('#backup-text').fill(text);
}
async function review(page: Page, text: string, asFile = false) {
  if (asFile)
    await page.evaluate((content) => {
      const input = document.querySelector<HTMLInputElement>('#backup-file');
      if (!input) throw new Error('Missing file input');
      const transfer = new DataTransfer();
      transfer.items.add(new File([content], 'recovery.json', { type: 'application/json' }));
      input.files = transfer.files;
    }, text);
  else await paste(page, text);
  await page.getByRole('button', { name: 'Review Import', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const r = indexedDB.open('resonance-bastion-v1');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction('campaigns'),
            q = tx.objectStore('campaigns').getAll();
          q.onsuccess = () => resolve(q.result);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}

test('mobile backup replaces selected wallets, preserves other slots/settings, reloads and rolls back without merging', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await page.getByRole('button', { name: 'Return to title', exact: true }).click();
  await create(page, 'Recovery Second');
  await page.getByRole('button', { name: 'Return to title', exact: true }).click();
  await data(page);
  const backup = await exported(page);
  expect(JSON.parse(backup).slots).toHaveLength(2);
  const offered = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Backup', exact: true }).click();
  expect((await offered).suggestedFilename()).toBe('resonance-bastion-backup.json');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await page
    .getByRole('button', { name: 'Buy & Place Standard Barricade · 60 Credits', exact: true })
    .click();
  await page.getByLabel('X', { exact: true }).fill('18');
  await page.getByLabel('Y', { exact: true }).fill('18');
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Place', exact: true }).click();
  await expect(page.locator('#account')).toContainText('540 Credits');
  await data(page);
  await review(page, backup, true);
  await page.locator('[data-import-source="1"]').selectOption('skip');
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('replaced and Saved');
  const campaigns = (await saved(page)) as { name: string; credits: number }[];
  expect(campaigns.map((c) => c.credits)).toEqual([600, 600]);
  expect(campaigns[1]?.name).toBe('Recovery Second');
  await page.getByRole('button', { name: 'Restore Previous · Slot 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Restore Previous', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('restored and Saved');
  expect(((await saved(page)) as { credits: number }[])[0]?.credits).toBe(540);
  await page.reload();
  await page.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await expect(page.locator('#account')).toContainText('540 Credits');
});

test('corrupt checksums and duplicate JSON are rejected before native storage changes; delete has an explicit preview', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await data(page);
  const backup = await exported(page),
    before = await saved(page);
  await paste(page, backup.replace('"credits":600', '"credits":601'));
  await page.getByRole('button', { name: 'Review Import', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('checksum');
  expect(await saved(page)).toEqual(before);
  await paste(page, '{"schema":1,"schema":2}');
  await page.getByRole('button', { name: 'Review Import', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Duplicate');
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Delete Campaign · Slot 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm Delete Campaign', exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Confirm Delete Campaign', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('deletion committed');
  expect(await saved(page)).toEqual([]);
});

test('a quota failure after writes were queued aborts all imported slots and leaves an exact retry', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await page.getByRole('button', { name: 'Return to title', exact: true }).click();
  await create(page, 'Second');
  await data(page);
  const backup = await exported(page),
    before = await saved(page);
  await review(page, backup);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'campaigns' && args[1] === 1) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('Injected quota failure', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Injected quota failure');
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('replaced and Saved');
  expect(((await saved(page)) as { revision: number }[]).map((c) => c.revision)).toEqual([1, 1]);
});

test('writer takeover rejects a stale recovery preview and preserves the other writer campaign', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await create(page);
  await data(page);
  const backup = await exported(page);
  await review(page, backup);
  const before = await saved(page);
  const other = await context.newPage();
  await other.goto('./');
  await other.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await other.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Read Only');
  expect(await saved(other)).toEqual(before);
  await other.close();
});

test('export includes native interrupted practice and import refuses to replace it with a conflicting older backup', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await data(page);
  const older = await exported(page);
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await expect(page.locator('#checkpoint-label')).toContainText('Checkpoint Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await data(page);
  const complete = JSON.parse(await exported(page));
  expect(complete.slots[0].practice.plan.simulation).toBe('rb-sim-v2');
  expect(complete.slots[0].practice.identity).toMatch(/^[a-f0-9]{64}$/);
  await expect(
    page.getByRole('button', { name: 'Restore Previous · Slot 1', exact: true }),
  ).toBeDisabled();
  await review(page, older);
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Resolve the retained practice');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Interrupted Tutorial Practice', exact: true }),
  ).toBeVisible();
});

test('unknown future logical journals block backup/recovery rather than silently omitting pending state', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await data(page);
  const backup = await exported(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('resonance-bastion-v1');
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ schema: 99 }, 'future.pending.slot.0');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
  );
  const before = await saved(page);
  await page.getByRole('button', { name: 'Prepare Backup', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Unsupported retained logical state');
  await review(page, backup);
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Unsupported retained logical state');
  expect(await saved(page)).toEqual(before);
});

test('global accessibility is preserved unless the player explicitly applies included settings', async ({
  page,
}) => {
  await page.goto('./');
  await create(page);
  await data(page);
  await page.locator('#export-preferences').check();
  const backup = await exported(page);
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page
    .getByRole('button', { name: 'Accessibility', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('combobox', { name: 'Interface scale', exact: true }).selectOption('27');
  await expect(page.locator('html')).toHaveCSS('font-size', '27px');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await data(page);
  await review(page, backup);
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('replaced and Saved');
  await expect(page.locator('html')).toHaveCSS('font-size', '27px');
  await review(page, backup);
  await page.locator('#import-preferences').check();
  await page.getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('replaced and Saved');
  await expect(page.locator('html')).toHaveCSS('font-size', '18px');
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('font-size', '18px');
});
