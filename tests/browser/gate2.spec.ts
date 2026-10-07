import { expect, test, type Page } from '@playwright/test';
async function create(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Combat Proof');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
}
test('real tutorial is autonomous, paused, restarted from durable checkpoint, and saved as practice victory', async ({
  page,
}) => {
  test.setTimeout(500000);
  await page.setViewportSize({ width: 800, height: 1280 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await create(page);
  await expect(page.getByRole('button', { name: 'Place', exact: true })).not.toBeVisible();
  await expect(page.locator('#checkpoint-label')).toContainText('Checkpoint Saved');
  await expect(page.locator('#battle-root')).toHaveAttribute('data-audio-state', 'running');
  await expect
    .poll(async () => Number(await page.locator('#battle-root').getAttribute('data-audio-decoded')))
    .toBeGreaterThan(0);
  await page.locator('#battle-speed').selectOption('1');
  await page.waitForTimeout(1000);
  await page.locator('#battle-pause').click();
  const tick = await page.locator('#battle-root').getAttribute('data-tick');
  await page.waitForTimeout(300);
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(tick);
  await page.screenshot({ path: 'test-results/gate2-paused-tablet.png', fullPage: true });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Interrupted Tutorial Practice' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart From Checkpoint', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
  await page.locator('#battle-speed').selectOption('4');
  for (let attempt = 0; attempt < 180; attempt++) {
    const state = await page.locator('#battle-root').getAttribute('data-state');
    if (state === 'Victory') break;
    if (state === 'Paused') {
      await page.locator('#battle-speed').selectOption('1');
      await page.locator('#battle-pause').click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Victory');
  await expect(page.locator('#battle-content')).toContainText('24 / 24');
  await expect(page.locator('#battle-content')).toContainText('Practice Result Saved');
  await expect(page.locator('#battle-root')).toHaveAttribute('data-result-hash', /^[a-f0-9]{64}$/);
  await page.screenshot({ path: 'test-results/gate2-practice-victory.png', fullPage: true });
  const soundHash = await page.locator('#battle-root').getAttribute('data-result-hash');
  const checkpoint = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('resonance-bastion-v1');
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction('meta').objectStore('meta').get('practice.slot.0');
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
        };
      }),
  );
  await test.info().attach('native-browser-checkpoint.json', {
    body: JSON.stringify(checkpoint),
    contentType: 'application/json',
  });
  await page.getByRole('button', { name: 'Practice Again', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await page.locator('#battle-mute').click();
  await expect(page.locator('#battle-mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#battle-speed').selectOption('2');
  for (let attempt = 0; attempt < 220; attempt++) {
    const state = await page.locator('#battle-root').getAttribute('data-state');
    if (state === 'Victory') break;
    if (state === 'Paused') {
      await page.locator('#battle-speed').selectOption('1');
      await page.locator('#battle-pause').click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Victory');
  await expect(page.locator('#battle-root')).toHaveAttribute('data-result-hash', soundHash ?? '');
  await page.getByRole('button', { name: 'Discard Practice and Return Base', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm Discard Practice and Return Base', exact: true })
    .click();
  await expect(page.locator('#account')).toContainText('600');
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#preparation')).toBeVisible();
  await expect(page.locator('#account')).toContainText('600');
  expect(errors).toEqual([]);
});
test('surrender result abort offers idempotent retry and leaves the real campaign intact', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = original.call(this, stores, mode, options);
      const keys = typeof stores === 'string' ? [stores] : Array.from(stores);
      const w = window as typeof window & { rbFailResult?: boolean };
      if (
        w.rbFailResult &&
        mode === 'readwrite' &&
        keys.includes('campaigns') &&
        keys.includes('meta')
      ) {
        w.rbFailResult = false;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
  });
  await create(page);
  const lost = await page.locator('#battle-world canvas').evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement,
      gl = c.getContext('webgl') || c.getContext('webgl2'),
      ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 200);
    return true;
  });
  expect(lost).toBe(true);
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  await expect(
    page.getByText('Renderer restored. Camera and saved state preserved.', { exact: true }),
  ).toBeVisible();
  const contextTick = await page.locator('#battle-root').getAttribute('data-tick');
  await page.waitForTimeout(150);
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(contextTick);
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Surrender Practice', exact: true }).click();
  await page.evaluate(() => {
    (window as typeof window & { rbFailResult?: boolean }).rbFailResult = true;
  });
  await page.getByRole('button', { name: 'Confirm Surrender Practice', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Practice Result Recovery', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry Save Practice Result', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Defeat');
  await expect(page.locator('#battle-content')).toContainText('Practice Result Saved');
  await page.getByRole('button', { name: 'Discard Practice and Return Base', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm Discard Practice and Return Base', exact: true })
    .click();
  await expect(page.locator('#account')).toContainText('600');
});
test('competing tab takeover freezes the old battle and offers the retained checkpoint to the new writer', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await create(page);
  const other = await context.newPage();
  await other.goto('./');
  await other.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await other.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused', {
    timeout: 15000,
  });
  const before = await page.locator('#battle-root').getAttribute('data-tick');
  await page.waitForTimeout(300);
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(before);
  await other.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    other.getByRole('heading', { name: 'Interrupted Tutorial Practice', exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole('button', { name: 'Restart From Checkpoint', exact: true }),
  ).toBeEnabled();
});
