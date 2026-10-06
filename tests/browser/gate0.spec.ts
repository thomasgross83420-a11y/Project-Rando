import { expect, test } from '@playwright/test';
test('Gate 0 production subpath, renderer, storage, gesture, audio and export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?diagnostics=gate0');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#storage')).toHaveText('Storage transaction committed');
  await page.getByRole('button', { name: 'Rotate view' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas missing');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#status')).toHaveText('Cell 30, 30');
  await page.getByRole('button', { name: 'Enable sound' }).click();
  await expect(page.locator('#audio')).toContainText('Audio unlocked');
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export capability report' }).click();
  expect((await download).suggestedFilename()).toBe('resonance-capabilities.json');
  await page.reload();
  await expect(page.locator('#storage')).toHaveText('Storage transaction committed');
  expect(errors).toEqual([]);
});

test('IndexedDB abort is reported; failed open offers a temporary session', async ({ page }) => {
  await page.goto('./?diagnostics=gate0');
  await expect(page.locator('#storage')).toContainText('committed');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const tx = original.apply(this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await page.getByRole('button', { name: 'Test save transaction' }).click();
  await expect(page.locator('#storage')).toContainText('Save Failed');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      value: {
        open: () => {
          throw new Error('Injected storage denial');
        },
      },
    });
  });
  await page.reload();
  await expect(page.locator('#storage')).toContainText('Temporary Session available');
  await expect(page.locator('canvas')).toBeVisible();
});

test('actual WebGL context loss restores presentation', async ({ page }) => {
  await page.goto('./?diagnostics=gate0');
  await expect(page.locator('canvas')).toBeVisible();
  const available = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl') as WebGLRenderingContext | null;
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 300);
    return true;
  });
  expect(available).toBe(true);
  await expect(page.locator('#status')).toContainText('Renderer restored');
  await page.getByRole('button', { name: 'Rotate view' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('viewport reflow, touch cancellation, semantic focus and production MIME', async ({
  page,
  request,
}) => {
  await page.goto('./?diagnostics=gate0#camera');
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 412, height: 915 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '36px';
    });
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Fit field' }).focus();
    await expect(page.getByRole('button', { name: 'Fit field' })).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1 });
  await expect(page.locator('#status')).toContainText('Gesture cancelled');
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  for (const url of await page
    .locator('script[src],link[rel=stylesheet][href]')
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('src') ?? n.getAttribute('href') ?? ''),
    )) {
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/javascript|css/);
  }
  const icon = await request.get((await page.locator('link[rel=icon]').getAttribute('href')) ?? '');
  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toMatch(/image\/png/);
  await page.screenshot({ path: 'test-results/gate0-200-percent.png', fullPage: true });
});
