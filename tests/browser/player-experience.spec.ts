import { test, expect, type Page } from '@playwright/test';
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function create(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Create Bastion', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next siege →', exact: true })).toBeVisible();
}
async function saved(page: Page) {
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  return page.evaluate(() => window.RBFullFixture.read());
}
for (const size of [
  { width: 360, height: 640 },
  { width: 800, height: 1280 },
  { width: 1280, height: 800 },
])
  test(`objective, briefing and touch controls fit ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await create(page);
    await page.getByRole('button', { name: 'Next siege →', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start siege', exact: true })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const field = document.querySelector('#full-field')!.getBoundingClientRect(),
        panel = document.querySelector('#full-panel')!.getBoundingClientRect(),
        start = Array.from(document.querySelectorAll('button'))
          .find((b) => b.textContent === 'Start siege')!
          .getBoundingClientRect();
      return {
        field: { x: field.x, bottom: field.bottom, h: field.height },
        panel: { y: panel.y, right: panel.right },
        start: { bottom: start.bottom },
        scroll: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.field.h).toBeGreaterThan(80);
    expect(geometry.scroll).toBe(size.width);
    expect(geometry.start.bottom).toBeLessThan(size.height - 50);
    expect(
      geometry.field.bottom <= geometry.panel.y + 2 || geometry.field.x >= geometry.panel.right - 2,
    ).toBe(true);
    const targets = await page
      .locator('#full-bar button,.camera-tools button,.panel-heading button,.panel-cta button')
      .evaluateAll((bs) =>
        bs.map((b) => {
          const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
    for (const t of targets) {
      expect(t.h).toBeGreaterThanOrEqual(48);
      expect(t.w).toBeGreaterThanOrEqual(48);
    }
    await page.screenshot({ path: `test-results/experience-${size.width}x${size.height}.png` });
  });
test('cancel spends nothing, invalid placement preserves the wallet and double confirmation buys once', async ({
  page,
}) => {
  await create(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Build · 250 ◈', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await saved(page)).credits).toBe(before.credits);
  await page.getByRole('button', { name: 'Build · 250 ◈', exact: true }).click();
  await page.getByText('Precise placement', { exact: true }).click();
  await page.getByLabel('Cell X', { exact: true }).fill('28');
  await page.getByLabel('Cell Y', { exact: true }).fill('28');
  await page.getByRole('button', { name: 'Preview cell', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeDisabled();
  expect((await saved(page)).credits).toBe(before.credits);
  await page.getByText('Precise placement', { exact: true }).click();
  await page.getByLabel('Cell X', { exact: true }).fill('34');
  await page.getByLabel('Cell Y', { exact: true }).fill('24');
  await page.getByRole('button', { name: 'Preview cell', exact: true }).click();
  await page.getByRole('button', { name: 'Place', exact: true }).dblclick();
  await expect(page.locator('#full-panel')).toBeHidden();
  const after = await saved(page);
  expect(after.credits).toBe(before.credits - 250);
  expect(after.assets.length).toBe(before.assets.length + 1);
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
  expect((await saved(page)).credits).toBe(after.credits);
});
test('nested Back restores its caller and Army filters explain an empty list', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Army', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect', exact: true }).first().click();
  await page.getByRole('button', { name: 'Back to previous menu', exact: true }).click();
  await expect(page.getByLabel('Show assets', { exact: true })).toBeVisible();
  await page.getByLabel('Show assets', { exact: true }).selectOption('Storage');
  await expect(page.locator('.army-row')).toHaveCount(0);
  await expect(page.getByText('No assets in storage.', { exact: false })).toBeVisible();
});
test('native focused buttons toggle pause once; map inspection needs explicit Resume', async ({
  page,
}) => {
  await create(page);
  await page.getByRole('button', { name: 'Next siege →', exact: true }).click();
  await page.getByRole('button', { name: 'Start siege', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open tactical map', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});
test('native touch pans in eight directions and pinches without changing the saved force', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await create(page);
  const before = await saved(page),
    field = page.locator('#full-field'),
    r = (await field.boundingBox())!,
    cx = r.x + r.width / 2,
    cy = r.y + r.height / 2;
  const client = await context.newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchEnd' | 'touchMove' | 'touchCancel',
    points: { x: number; y: number; id: number }[],
  ) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  for (const [dx, dy] of [
    [60, 0],
    [-60, 0],
    [0, 60],
    [0, -60],
    [45, 45],
    [-45, -45],
    [45, -45],
    [-45, 45],
  ]) {
    const prev = await field.getAttribute('data-camera-x');
    const py = await field.getAttribute('data-camera-y');
    await touch('touchStart', [{ x: cx, y: cy, id: 1 }]);
    await touch('touchMove', [{ x: cx + dx!, y: cy + dy!, id: 1 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(80);
    expect(
      (await field.getAttribute('data-camera-x')) !== prev ||
        (await field.getAttribute('data-camera-y')) !== py,
    ).toBe(true);
    await expect(page.locator('#full-panel')).toBeHidden();
  }
  const z = Number(await field.getAttribute('data-zoom'));
  await touch('touchStart', [
    { x: cx - 40, y: cy, id: 1 },
    { x: cx + 40, y: cy, id: 2 },
  ]);
  await touch('touchMove', [
    { x: cx - 80, y: cy, id: 1 },
    { x: cx + 80, y: cy, id: 2 },
  ]);
  await touch('touchEnd', []);
  await page.waitForTimeout(80);
  expect(Number(await field.getAttribute('data-zoom'))).toBeGreaterThan(z);
  expect((await saved(page)).assets).toEqual(before.assets);
  expect((await saved(page)).credits).toBe(before.credits);
});
test('200% text, high contrast, map zoom alternatives and all camera orientations remain operable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await create(page);
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('UI scale', { exact: true }).selectOption('200');
  await page.getByLabel('Contrast', { exact: true }).selectOption('High');
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Rotate view', exact: true }).click();
    await expect(page.locator('#full-field')).toHaveAttribute('data-view', String((i + 1) % 4));
  }
  await page.getByRole('button', { name: 'Open tactical map', exact: true }).click();
  const z = Number(await page.locator('#full-field').getAttribute('data-zoom'));
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(async () => Number(await page.locator('#full-field').getAttribute('data-zoom')))
    .toBeGreaterThan(z);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.screenshot({ path: 'test-results/experience-200-percent.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(800);
});
test('touch sets a reviewed rally point without moving or repurchasing the defender', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await create(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Army', exact: true }).click();
  const row = page.locator('.army-row').filter({ hasText: 'Rifle Squad' }).first();
  await row.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page.getByRole('button', { name: 'Tactics', exact: true }).click();
  await page.getByRole('button', { name: 'Choose rally point on field', exact: true }).click();
  const field = page.locator('#full-field');
  await expect(page.locator('#full-panel')).toBeHidden();
  const r = (await field.boundingBox())!,
    cx = Number(await field.getAttribute('data-camera-x')),
    cy = Number(await field.getAttribute('data-camera-y')),
    z = Number(await field.getAttribute('data-zoom'));
  await page.touchscreen.tap(
    r.x + r.width / 2 + 16 * z * (26.3 - cx - (32.3 - cy)),
    r.y + r.height / 2 + 8 * z * (26.3 - cx + (32.3 - cy)),
  );
  await page.locator('dialog').getByRole('button', { name: 'Set point', exact: true }).click();
  const after = await saved(page),
    old = before.assets.find((a) => a.type === 'friendly.rifle_squad')!,
    updated = after.assets.find((a) => a.id === old.id)!;
  expect(updated.tactics.anchor).toEqual({ x: 26, y: 32 });
  expect(updated.placement).toEqual(old.placement);
  expect(after.credits).toBe(before.credits);
});
test('a long browser interruption pauses the siege until the player resumes', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Next siege →', exact: true }).click();
  await page.getByRole('button', { name: 'Start siege', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const end = performance.now() + 1200;
    while (performance.now() < end) {
      /* Simulate a real main-thread interruption. */
    }
  });
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});
test('stalled cleanup opens recovery, restarts practice and preserves the real wallet and army', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('./');
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  const before = await page.evaluate(() => window.RBFullFixture.seedCoverageGap());
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
  await page.getByRole('button', { name: 'Siege', exact: true }).click();
  await page.getByText('Other ways to play & difficulty', { exact: true }).click();
  await page.getByLabel('Mode', { exact: true }).selectOption('Calibration');
  await page.getByLabel('Enemy role', { exact: true }).selectOption('Mender');
  await page.getByLabel('Count', { exact: true }).fill('1');
  await page.getByLabel('Entrance', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Review forecast', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.locator('[data-system="speed"]').click();
  await page.locator('[data-system="speed"]').click();
  await expect(page.getByText('No progress for 90 seconds.', { exact: false }).first()).toBeVisible(
    { timeout: 60000 },
  );
  await page.getByRole('button', { name: 'Restart checkpoint', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('[data-system="speed"]')).toHaveText('1×');
  await page.getByRole('button', { name: 'Siege tools', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
  const after = await saved(page);
  expect(after.credits).toBe(before.credits);
  expect(after.assets).toEqual(before.assets);
});
test('a stocked trap is a valid ground damage counter without a silently added Warden', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  const before = await page.evaluate(() => window.RBFullFixture.seedTrapDefense());
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
  await page.getByRole('button', { name: 'Siege', exact: true }).click();
  await page.getByText('Other ways to play & difficulty', { exact: true }).click();
  await page.getByLabel('Mode', { exact: true }).selectOption('Calibration');
  await page.getByLabel('Count', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Review forecast', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siege tools', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
  const after = await saved(page);
  expect(after.assets).toEqual(before.assets);
  expect(after.credits).toBe(before.credits);
});
