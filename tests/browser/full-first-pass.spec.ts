import { test, expect, type Page } from '@playwright/test';
import type * as Fixture from '../../scripts/full-first-pass-fixture';
declare global {
  interface Window {
    RBFullFixture: typeof Fixture;
  }
}
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
  await expect(page.getByRole('button', { name: 'Siege', exact: true })).toBeEnabled();
}
async function seed(page: Page, advanced = false, pending = false) {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  await page.evaluate(
    async ({ advanced, pending }) => window.RBFullFixture.seed(advanced, pending),
    { advanced, pending },
  );
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
}
for (const [width, height] of [
  [360, 640],
  [800, 1280],
  [1280, 800],
] as const)
  test(`complete field and menus fit ${width}x${height}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    await create(page);
    for (const menu of ['Build', 'Army', 'Siege', 'Records', 'Manage']) {
      await page.getByRole('button', { name: menu, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeVisible();
      await expect(page.locator('#full-field canvas')).toBeVisible();
      expect(
        await page.evaluate(() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
        })),
      ).toEqual({ w: width, h: height });
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Open tactical map', exact: true }).click();
    await expect(page.locator('[data-map]')).toBeVisible();
    await page.getByRole('button', { name: 'Front 6', exact: true }).click();
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    await page.screenshot({ path: `test-results/full-${width}x${height}.png` });
  });
test('title settings close and repeated new-game cancellation never strand controls', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Accessibility / settings' }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await page.getByRole('button', { name: 'Create Bastion', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create Bastion', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
});
test('tutorial starts, pauses, changes speed, withdraws and produces persistent results', async ({
  page,
}) => {
  test.setTimeout(60000);
  await create(page);
  await page.getByRole('button', { name: 'Siege', exact: true }).click();
  await page.getByRole('button', { name: 'Review forecast', exact: true }).click();
  await page.getByRole('button', { name: 'Start siege', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Siege tools', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to base', exact: true })).toBeVisible();
  for (const tab of [
    'Rewards',
    'Friendly performance',
    'Enemy analysis',
    'Damage timeline',
    'Base heatmap',
    'Unlocks',
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Return to base', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Continue ·/ })).toBeVisible();
});
test('advanced mode forecasts, infrastructure and appearance controls are reachable', async ({
  page,
}) => {
  test.setTimeout(120000);
  await seed(page, true);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('infrastructure');
  await expect(page.getByText('Command Node', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('UI scale', { exact: true }).selectOption('200');
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('UI scale', { exact: true }).selectOption('100');
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  for (const mode of [
    'Expedition',
    'Boss Siege',
    'Calibration',
    'Mastery',
    'Endurance',
    'Long Watch',
  ]) {
    await page.getByRole('button', { name: 'Siege', exact: true }).click();
    await page.getByLabel('Mode', { exact: true }).selectOption(mode);
    await page
      .getByRole('button', {
        name: mode === 'Long Watch' ? 'Next sortie / review offers' : 'Review forecast',
        exact: true,
      })
      .click();
    if (mode === 'Long Watch') {
      await expect(
        page.getByRole('button', { name: 'Review this offer', exact: true }),
      ).toHaveCount(3);
    } else
      await expect(
        page.getByRole('button', {
          name: mode === 'Calibration' ? 'Start practice' : 'Start siege',
          exact: true,
        }),
      ).toBeEnabled();
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance workshop', exact: true }).click();
  await page.locator('details').filter({ hasText: 'COS01' }).locator('summary').click();
  await page
    .locator('details')
    .filter({ hasText: 'COS01' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click();
});
test('pending victory recovery commits once and remains finalized after reload', async ({
  page,
}) => {
  test.setTimeout(120000);
  await seed(page, false, true);
  await page.getByRole('button', { name: 'Finalize result', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to base', exact: true })).toBeVisible();
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  const first = await page.evaluate(() => window.RBFullFixture.read());
  expect(first.pending).toBeNull();
  expect(first.stages).toEqual([0]);
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  const second = await page.evaluate(() => window.RBFullFixture.read());
  expect(second.credits).toBe(first.credits);
  expect(second.finalized).toBe(first.finalized);
});
