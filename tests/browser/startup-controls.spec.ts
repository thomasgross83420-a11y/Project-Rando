import { prepMenu } from './menu-helpers';
import { expect, test, type Page } from '@playwright/test';

async function create(page: Page) {
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Retained startup');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#preparation')).toBeVisible();
}
async function retained(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('resonance-bastion-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const campaigns = await new Promise((resolve, reject) => {
      const request = db.transaction('campaigns').objectStore('campaigns').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return campaigns;
  });
}
test('reload and reopening a closed page restore editing without changing campaigns', async ({
  page,
  context,
}) => {
  await page.goto('./?legacy=1');
  await create(page);
  const before = await retained(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Take Over Editing', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await prepMenu(page, 'build');
  await expect(page.getByRole('button', { name: /Sentry 2 · Stored/ })).toBeEnabled();
  expect(await retained(page)).toEqual(before);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('./?legacy=1');
  await expect(reopened.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  await expect(
    reopened.getByRole('button', { name: 'Take Over Editing', exact: true }),
  ).toHaveCount(0);
  expect(await retained(reopened)).toEqual(before);
});
test('another active tab can start New Game through confirmed takeover and the old controls refresh', async ({
  page,
  context,
}) => {
  await page.goto('./?legacy=1');
  await create(page);
  const before = await retained(page);
  const other = await context.newPage();
  await other.goto('./?legacy=1');
  await other.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(
    other.getByRole('heading', { name: 'Take Over Editing', exact: true }),
  ).toBeVisible();
  await other.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  expect(await retained(other)).toEqual(before);
  await other.getByRole('button', { name: 'New Game', exact: true }).click();
  await other.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await expect(
    other.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  await prepMenu(page, 'build');
  await expect(page.getByRole('button', { name: /Sentry 2 · Stored/ })).toBeDisabled({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Take Over Editing', exact: true })).toBeVisible();
  expect(await retained(other)).toEqual(before);
});
test('legacy ownership offers a working recovery from New Game instead of a gray dead end', async ({
  page,
}) => {
  await page.goto('./?legacy=1');
  await create(page);
  const before = await retained(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('resonance-bastion-v1');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('writer', 'readwrite');
      tx.objectStore('writer').put(
        { tabID: crypto.randomUUID(), generation: 50, leaseExpiry: Date.now() - 1000 },
        'active',
      );
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(await retained(page)).toEqual(before);
});
test('a failed writer transaction keeps title controls and a retry path available', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    let failed = false;
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = original.call(this, stores, mode, options);
      if (
        !failed &&
        mode === 'readwrite' &&
        Array.from(typeof stores === 'string' ? [stores] : stores).includes('writer')
      ) {
        failed = true;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
  });
  await page.goto('./?legacy=1');
  await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('failed storage probe offers explicit temporary play without breaking the title', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'probe') throw new DOMException('Injected probe failure', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.goto('./?legacy=1');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Storage unavailable', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start Temporary Session', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('without Web Locks, closed legacy ownership still requires confirmation and saves remain unchanged', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('./?legacy=1');
  await create(page);
  const before = await retained(page);
  await page.reload();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(await retained(page)).toEqual(before);
});
test('title buttons and cancelled creation stay usable, and unfinished combat choices are clearly unavailable', async ({
  page,
}) => {
  await page.goto('./?legacy=1');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  for (const name of ['How to Play', 'Accessibility', 'Settings', 'Credits']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open campaign', exact: true }).first(),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
    await expect(page.getByLabel('Doctrine')).toHaveValue('Bastion');
    await expect(page.getByLabel('Warden', { exact: true })).toHaveValue('warden.bulwark');
    await expect(page.locator('#doctrine option[value="Mobile"]')).toBeDisabled();
    await expect(page.locator('#warden option[value="warden.ranger"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  }
  expect(await retained(page)).toEqual([]);
  await create(page);
  await prepMenu(page, 'siege');
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Return Base', exact: true }).click();
  await prepMenu(page, 'build');
  await expect(page.getByRole('button', { name: /Sentry 2 · Stored/ })).toBeEnabled();
});
test('a campaign saved before an open failure remains loadable without retrying creation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?legacy=1');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (!failed && key === 'lastOpened') {
        failed = true;
        throw new DOMException('Injected open failure', 'QuotaExceededError');
      }
      return original.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Saved before open');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Campaign saved, but could not be opened');
  await page.getByRole('button', { name: 'Load Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Open campaign', exact: true }).first().click();
  await expect(page.locator('#campaign-heading')).toHaveText('Saved before open');
  expect(await retained(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a rejected Web Lock request does not strand startup and can be retried', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    let failed = false;
    navigator.locks.request = ((...args: Parameters<LockManager['request']>) => {
      if (!failed) {
        failed = true;
        return Promise.reject(new DOMException('Injected lock rejection', 'AbortError'));
      }
      return original(...args);
    }) as LockManager['request'];
  });
  await page.goto('./?legacy=1');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('writer quota errors stay recoverable without uncaught request-handler errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (!failed && this.name === 'writer') {
        failed = true;
        throw new DOMException('Injected writer quota', 'QuotaExceededError');
      }
      return original.call(this, value, key);
    };
  });
  await page.goto('./?legacy=1');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'New Campaign — Select Slot', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('a displaced battle never automatically resumes after the other writer closes; takeover opens durable recovery', async ({
  page,
  context,
}) => {
  test.setTimeout(45000);
  await page.goto('./?legacy=1');
  await create(page);
  const before = await retained(page);
  await prepMenu(page, 'siege');
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
  const other = await context.newPage();
  await other.goto('./?legacy=1');
  await other.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await other.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  await other.close();
  await page.waitForTimeout(5500);
  const tick = await page.locator('#battle-root').getAttribute('data-tick');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(tick);
  await page.locator('#battle-close').click();
  await page.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Interrupted Tutorial Practice', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Restart From Checkpoint', exact: true }),
  ).toBeEnabled();
  expect(await retained(page)).toEqual(before);
});
