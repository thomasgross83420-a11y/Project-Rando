import { expect, test, type Page } from '@playwright/test';
import { battleTools, closePrepMenu, precisePlacement, prepMenu } from './menu-helpers';

async function create(page: Page) {
  await page.goto('./?legacy=1');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Field First');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page.locator('#world')).toHaveAttribute('data-zoom', /[0-9]/);
}
async function fieldFits(page: Page, id: string) {
  const box = await page.locator(id).boundingBox();
  if (!box) throw new Error('Field missing');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport missing');
  expect(box.height).toBeGreaterThanOrEqual(240);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 30);
  expect(
    await page.evaluate(() => ({
      x: scrollX,
      y: scrollY,
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    })),
  ).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
}
for (const [width, height] of [
  [360, 640],
  [412, 915],
  [800, 1280],
  [1280, 800],
  [320, 640],
] as const) {
  test(`field and collapsible menus fit ${width}×${height} at 100% and 200%`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: width, height });
    await create(page);
    for (const scale of [18, 36]) {
      await prepMenu(page, 'tools');
      await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
      await page.getByLabel('Interface scale').selectOption(String(scale));
      await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
      await closePrepMenu(page);
      await fieldFits(page, '#world');
      for (const panel of ['build', 'forces', 'upgrade', 'tactics', 'siege', 'records', 'tools']) {
        await prepMenu(page, panel);
        const drawer = await page.locator('#prep-sidebar').boundingBox();
        const field = await page.locator('#world').boundingBox();
        expect(drawer?.y).toBeGreaterThanOrEqual(field?.y ?? 0);
        expect((drawer?.y ?? 0) + (drawer?.height ?? 0)).toBeLessThanOrEqual(
          (field?.y ?? 0) + (field?.height ?? 0) + 1,
        );
        const close = page.getByRole('button', { name: 'Close menu', exact: true });
        const control = await close.boundingBox();
        expect(control?.height).toBeGreaterThanOrEqual(48);
        expect(control?.width).toBeGreaterThanOrEqual(48);
        await page.keyboard.press('Escape');
        await expect(page.locator(`[data-prep-panel="${panel}"]`)).toBeFocused();
        await expect(page.locator('#prep-sidebar')).toBeHidden();
        await fieldFits(page, '#world');
      }
      await page.screenshot({ path: `test-results/touch-prep-${width}x${height}-${scale}.png` });
    }
  });
}
test('native touch pans in every direction, pinches about the midpoint, and continues with the remaining finger', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await create(page);
  const box = await page.locator('#world canvas').boundingBox();
  if (!box) throw new Error('Field missing');
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  const camera = () =>
    page.locator('#world').evaluate((e) => ({
      x: Number(e.getAttribute('data-center-x')),
      y: Number(e.getAttribute('data-center-y')),
      zoom: Number(e.getAttribute('data-zoom')),
    }));
  const beforeWallet = await page.locator('#account').textContent();
  for (const [dx, dy] of [
    [30, 0],
    [-30, 0],
    [0, 30],
    [0, -30],
    [30, 30],
    [-30, 30],
    [30, -30],
    [-30, -30],
  ] as const) {
    const before = await camera();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: cx, y: cy, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx + dx, y: cy + dy, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await camera();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.1);
    expect(after.zoom).toBe(before.zoom);
  }
  const before = await camera();
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
      { x: cx - 65, y: cy, id: 1 },
      { x: cx + 65, y: cy, id: 2 },
    ],
  });
  const pinched = await camera();
  expect(pinched.zoom).toBeGreaterThan(before.zoom);
  expect(pinched.x).toBeCloseTo(before.x, 4);
  expect(pinched.y).toBeCloseTo(before.y, 4);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: cx + 65, y: cy, id: 2 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: cx - 35, y: cy + 20, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const continued = await camera();
  expect(Math.hypot(continued.x - pinched.x, continued.y - pinched.y)).toBeGreaterThan(0.1);
  await expect(page.locator('#account')).toHaveText(beforeWallet ?? '');
  await expect(page.locator('#dialog')).not.toBeVisible();
  await fieldFits(page, '#world');
  await cdp.detach();
});
test('choosing a build closes the menu; pinch continuation never moves or buys the ghost', async ({
  page,
  context,
}) => {
  await create(page);
  await prepMenu(page, 'build');
  await page.getByRole('button', { name: 'Buy & Place Sentry · 250 Credits', exact: true }).click();
  await expect(page.locator('#prep-sidebar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeVisible();
  const coords = await page.locator('#place-x').inputValue();
  const box = await page.locator('#world canvas').boundingBox();
  if (!box) throw new Error('Field missing');
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 3;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx - 30, y: cy, id: 1 },
      { x: cx + 30, y: cy, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: cx - 50, y: cy, id: 1 },
      { x: cx + 50, y: cy, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: cx + 50, y: cy, id: 2 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: cx - 20, y: cy + 20, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#place-x')).toHaveValue(coords);
  await expect(page.locator('#account')).toContainText('600 Credits');
  await expect(page.locator('#account')).toContainText('Capacity 0/20');
  await prepMenu(page, 'tools');
  await page.keyboard.press('Escape');
  await expect(page.locator('#prep-details')).toBeVisible();
  await expect(page.locator('#place-x')).toHaveValue(coords);
  // Exercise the smaller content viewport used while editing with a keyboard.
  // This is reflow coverage, not a claim of native Android IME testing.
  await precisePlacement(page);
  await page.locator('#place-x').focus();
  await page.setViewportSize({ width: 360, height: 400 });
  await page.locator('#place-x').fill('18');
  await page.locator('#place-x').press('Tab');
  await page.locator('#place').scrollIntoViewIfNeeded();
  await expect(page.locator('#place')).toBeInViewport();
  await expect(page.locator('#cancel-placement')).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Cancel Placement', exact: true }).click();
  await expect(page.locator('#prep-details')).toBeHidden();
  await cdp.detach();
});
test('battle keeps the field visible and observation tools collapsed; opening and closing works by touch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await create(page);
  await prepMenu(page, 'siege');
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
  await fieldFits(page, '#battle-world');
  await expect(page.locator('#battle-tools-sheet')).toBeHidden();
  await expect(page.locator('#battle-inspector')).toBeHidden();
  await battleTools(page);
  await page.locator('#battle-speed').selectOption('2');
  await expect(page.locator('#battle-time')).toContainText('2×');
  await page.locator('#battle-map').click();
  await expect(page.locator('#battle-minimap')).toBeVisible();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege');
  await page.locator('#battle-tools-sheet > summary').click();
  await expect(page.locator('#battle-tools-sheet')).toBeHidden();
  await battleTools(page);
  await page.locator('#battle-inspect').click();
  await expect(page.locator('#battle-inspector')).toBeVisible();
  await page.locator('#battle-entity').selectOption('1');
  await expect(page.locator('#battle-details')).toContainText('Harmonic Core');
  await page.locator('#battle-inspector > summary').click();
  await expect(page.locator('#battle-inspector')).toBeHidden();
  await page.locator('#battle-pause').click();
  await expect(page.locator('#battle-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege');
  await fieldFits(page, '#battle-world');
  await page.screenshot({ path: 'test-results/touch-battle-360x640.png' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '36px';
  });
  await fieldFits(page, '#battle-world');
  await expect(page.locator('#core-health')).toBeInViewport();
  await expect(page.locator('#warden-health')).toBeInViewport();
  await expect(page.locator('#battle-pause')).toBeInViewport();
  await page.screenshot({ path: 'test-results/touch-battle-360x640-200.png' });
});
