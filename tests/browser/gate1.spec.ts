import { expect, test, type Page } from '@playwright/test';
async function create(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Tablet Bastion');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
}
async function place(page: Page, x: number, y: number): Promise<void> {
  await page.getByLabel('X', { exact: true }).fill(String(x));
  await page.getByLabel('Y', { exact: true }).fill(String(y));
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Place', exact: true }).click();
}
test('campaign creation, free deployment, atomic purchase, Undo/Redo and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await create(page);
  await expect(page.locator('#account')).toContainText('600 Credits');
  await page.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
  await place(page, 18, 18);
  await expect(page.locator('#status')).toContainText('Saved:');
  await expect(page.locator('#account')).toContainText('Capacity 2/20');
  await page
    .getByRole('button', { name: 'Buy & Place Standard Barricade · 60 Credits', exact: true })
    .click();
  await place(page, 22, 18);
  await expect(page.locator('#account')).toContainText('540 Credits');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#account')).toContainText('600 Credits');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#account')).toContainText('540 Credits');
  await page.getByRole('button', { name: 'Buy & Place Sentry · 250 Credits', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel Placement', exact: true }).click();
  await expect(page.locator('#account')).toContainText('540 Credits');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Campaign', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('resonance-slot-1.json');
  await page.screenshot({ path: 'test-results/gate1-construction.png', fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#account')).toContainText('540 Credits');
  await expect(page.getByRole('button', { name: /Sentry 2 · at 18,18/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
  expect(warnings.every((w) => /GL Driver Message.*GPU stall due to ReadPixels/.test(w))).toBe(
    true,
  );
  await test.info().attach('observed-browser-warnings', {
    body: JSON.stringify(warnings, null, 2),
    contentType: 'application/json',
  });
});
test('invalid placement and failed persistence preserve money and history', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Buy & Place Sentry · 250 Credits', exact: true }).click();
  await page.getByLabel('X', { exact: true }).fill('28');
  await page.getByLabel('Y', { exact: true }).fill('28');
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeDisabled();
  await expect(page.locator('#placement-reason')).toContainText('reserved');
  await expect(page.locator('#account')).toContainText('600 Credits');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const tx = original.apply(this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await place(page, 18, 18);
  await expect(page.locator('#status')).toContainText('failed');
  await expect(page.locator('#account')).toContainText('600 Credits');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});
test('second tab cannot edit until confirmed writer takeover; stale tab cannot commit', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const original = window.setInterval;
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      original(delay === 5000 ? () => {} : handler, delay, ...args)) as typeof setInterval;
  });
  await create(page);
  const other = await context.newPage();
  await other.goto('./');
  await expect(other.locator('#status')).toContainText('read-only');
  await other.getByRole('button', { name: 'Take Over Editing', exact: true }).click();
  await other.getByRole('button', { name: 'Confirm Take Over', exact: true }).click();
  await other.getByRole('button', { name: 'Continue', exact: true }).click();
  await other.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
  await place(other, 18, 18);
  await expect(other.locator('#status')).toContainText('Saved:');
  await page.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
  await place(page, 22, 22);
  await expect(page.locator('#status')).toContainText('failed');
  await expect(page.locator('#account')).toContainText('Capacity 0/20');
  await other.close();
});
test('explicit temporary session, native controls, viewport and 200% reflow', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      value: {
        open: () => {
          throw new Error('Injected denial');
        },
      },
    });
  });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start Temporary Session', exact: true }).click();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Temporary');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#account')).toContainText('Temporary Session');
  for (const [width, height] of [
    [360, 640],
    [412, 915],
    [800, 1280],
    [1280, 800],
    [320, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '36px';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Rotate view', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rotate view', exact: true })).toBeFocused();
  }
  await page.screenshot({ path: 'test-results/gate1-200-percent.png', fullPage: true });
});

test('high artwork selects the Core inspector in four views without purchasing; wizard cancel preserves slot', async ({
  page,
}) => {
  await create(page);
  for (let orientation = 0; orientation < 4; orientation++) {
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('Canvas missing');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 - 5);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Harmonic Core');
    await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
    await page.getByRole('button', { name: 'Rotate view', exact: true }).click();
  }
  await expect(page.locator('#account')).toContainText('600 Credits');
  await page.getByRole('button', { name: 'Return to title', exact: true }).click();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await expect(page.locator('.slot')).toHaveCount(3);
  await page.getByRole('button', { name: 'Review replacement', exact: true }).click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Discarded draft');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#campaign-heading')).toHaveText('Tablet Bastion');
  await expect(page.locator('#account')).toContainText('600 Credits');
});

test('native ghost drag and two-touch pinch/cancel never purchase', async ({ page, context }) => {
  await create(page);
  await page.getByRole('button', { name: 'Buy & Place Sentry · 250 Credits', exact: true }).click();
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 - 16, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByLabel('X', { exact: true })).not.toHaveValue('18');
  await expect(page.locator('#account')).toContainText('600 Credits');
  await expect(page.locator('#account')).toContainText('Capacity 0/20');
  await canvas.scrollIntoViewIfNeeded();
  box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas missing');
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cx - 40, y: cy, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx - 40, y: cy, id: 1 },
      { x: cx + 40, y: cy, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: cx - 60, y: cy, id: 1 },
      { x: cx + 60, y: cy, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#account')).toContainText('600 Credits');
  await expect(page.locator('#account')).toContainText('Capacity 0/20');
  await expect(page.getByRole('button', { name: 'Cancel Placement', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel Placement', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeDisabled();
  await cdp.detach();
});

test('hidden preparation retains a valid renderer through Title, scale and Continue', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await create(page);
  await page.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
  await place(page, 24, 28);
  await expect(page.locator('#status')).toContainText('Saved:');
  for (const size of [
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
  ]) {
    await page.getByRole('button', { name: 'Return to title', exact: true }).click();
    await expect(page.locator('#preparation')).toBeHidden();
    await page.setViewportSize(size);
    await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
    await page.locator('#ui-scale').selectOption('36');
    await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
    expect(
      await page
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.width > 0 && canvas.height > 0),
    ).toBe(true);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Rotate view', exact: true }).click();
    await expect(page.getByRole('button', { name: /Sentry 2 · at 24,28/ })).toBeVisible();
    await expect(page.locator('#account')).toContainText('600 Credits');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
