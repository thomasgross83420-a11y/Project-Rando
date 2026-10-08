import { closePrepMenu, precisePlacement, prepMenu } from './menu-helpers';
import { expect, test, type Page } from '@playwright/test';
async function create(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Closeout');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
}
async function place(page: Page, x: number, y: number) {
  await precisePlacement(page);
  await page.getByLabel('X', { exact: true }).fill(String(x));
  await precisePlacement(page);
  await page.getByLabel('Y', { exact: true }).fill(String(y));
  await precisePlacement(page);
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Place', exact: true }).click();
}
test('global scale, reduced effects and high contrast persist across reload and campaigns', async ({
  page,
}) => {
  await page.goto('./');
  await prepMenu(page, 'tools');
  await expect(page.getByRole('button', { name: 'Accessibility', exact: true })).toBeEnabled();
  await prepMenu(page, 'tools');
  await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await page.getByLabel('Interface scale').selectOption('36');
  await page.getByLabel('Reduced effects', { exact: true }).check();
  await page.getByLabel('High contrast construction').check();
  await page.getByRole('button', { name: 'Retry Save Preferences' }).click();
  await expect(page.locator('#status')).toContainText('preferences saved');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await page.reload();
  await prepMenu(page, 'tools');
  await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await expect(page.getByLabel('Interface scale')).toHaveValue('36');
  await expect(page.getByLabel('High contrast construction')).toBeChecked();
  await expect(page.getByLabel('Reduced effects', { exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/high-contrast/);
});
test('Fit Base, role badges, four views, route feedback and named jump operate without mutating the wallet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await create(page);
  await expect(page.locator('#world')).toHaveAttribute('data-fit', 'base');
  await expect(page.locator('#world')).toHaveAttribute('data-presentation', 'strategic');
  await expect(page.locator('#world')).toHaveAttribute('data-role-groups', '1');
  await expect(page.locator('#camera-summary')).toContainText('Strategic role icons');
  const base = Number(await page.locator('#world').getAttribute('data-zoom'));
  await prepMenu(page, 'tools', true);
  await page.getByRole('button', { name: 'Fit field', exact: true }).click();
  expect(Number(await page.locator('#world').getAttribute('data-zoom'))).toBeLessThan(base);
  await expect(page.locator('#world')).toHaveAttribute('data-presentation', 'strategic');
  await expect(page.locator('#world')).toHaveAttribute('data-role-groups', '1');
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('#world')).toHaveAttribute('data-orientation', String(i * 90));
    await prepMenu(page, 'tools', true);
    await page.getByRole('button', { name: 'Rotate view', exact: true }).click();
  }
  await prepMenu(page, 'build');
  await page.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
  await place(page, 24, 28);
  await expect(page.locator('#account')).toContainText('600 Credits');
  await prepMenu(page, 'tools');
  await page.getByRole('button', { name: 'Show Routes', exact: true }).click();
  await expect(page.locator('#route-summary')).toContainText('Valid Open Route');
  await prepMenu(page, 'build');
  await page.getByRole('button', { name: /Sentry 2 · at 24,28/ }).click();
  await closePrepMenu(page);
  await precisePlacement(page);
  await page.getByRole('button', { name: 'Jump to selected', exact: true }).click();
  await expect(page.locator('#world')).toHaveAttribute('data-fit', 'manual');
  await page.getByRole('button', { name: 'Cancel Placement', exact: true }).click();
  await prepMenu(page, 'build');
  await page.getByRole('button', { name: 'Buy & Place Sentry · 250 Credits', exact: true }).click();
  await precisePlacement(page);
  await page.getByLabel('X', { exact: true }).fill('28');
  await precisePlacement(page);
  await page.getByLabel('Y', { exact: true }).fill('28');
  await precisePlacement(page);
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await expect(page.locator('#route-summary')).toContainText('reserved');
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeDisabled();
  await expect(page.locator('#account')).toContainText('600 Credits');
});
test('landscape and portrait keep the world visible while tools collapse at normal and 200%', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await create(page);
  for (const scale of ['18', '36']) {
    await prepMenu(page, 'tools');
    await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
    await page.getByLabel('Interface scale').selectOption(scale);
    await page.getByLabel('High contrast construction').check();
    await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
    await closePrepMenu(page);
    await expect(page.locator('#prep-sidebar')).toBeHidden();
    const bounds = await page.locator('#world').boundingBox();
    expect(bounds?.width).toBeGreaterThan(1200);
    expect(bounds?.height).toBeGreaterThan(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await prepMenu(page, 'build');
    const drawer = await page.locator('#prep-sidebar').boundingBox();
    expect(drawer?.width).toBeLessThan(500);
    expect(drawer?.x).toBeGreaterThan(700);
    await page.screenshot({ path: `test-results/gate1-closeout-landscape-${scale}.png` });
    await closePrepMenu(page);
  }
  await page.setViewportSize({ width: 800, height: 1280 });
  await expect(page.locator('#world')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/gate1-closeout-portrait-200.png' });
});
test('preference transaction failure retains session presentation and offers retry without touching campaign', async ({
  page,
}) => {
  await create(page);
  await prepMenu(page, 'tools');
  await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await page.evaluate(() => {
    const old = IDBDatabase.prototype.transaction;
    Object.assign(window, {
      restorePreferencesTransaction: () => (IDBDatabase.prototype.transaction = old),
    });
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof old>) {
      const tx = old.apply(this, args);
      if (
        args[1] === 'readwrite' &&
        Array.isArray(args[0]) &&
        args[0].length === 1 &&
        args[0][0] === 'meta'
      )
        queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await page.getByLabel('High contrast construction').check();
  await page.getByRole('button', { name: 'Retry Save Preferences' }).click();
  await expect(page.locator('#status')).toContainText('Preferences not saved');
  await expect(page.locator('html')).toHaveClass(/high-contrast/);
  await page.evaluate(() => {
    (
      window as unknown as { restorePreferencesTransaction: () => void }
    ).restorePreferencesTransaction();
  });
  await page.getByRole('button', { name: 'Retry Save Preferences' }).click();
  await expect(page.locator('#status')).toContainText('preferences saved');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await expect(page.locator('#account')).toContainText('600 Credits');
});
