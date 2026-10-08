import { expect, type Page } from '@playwright/test';

// Navigate through the same visible menus as a player; never force hidden clicks.
export async function prepMenu(page: Page, panel: string, camera = false) {
  if (camera || ['build', 'forces', 'upgrade', 'tactics', 'siege'].includes(panel))
    await expect(page.locator('#preparation')).toBeVisible();
  else if (!(await page.locator('#preparation').isVisible())) return;
  const button = page.locator(`[data-prep-panel="${panel}"]`);
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(page.locator('#prep-sidebar')).toBeVisible();
  if (camera) {
    const options = page.locator('[data-panel="tools"] details').first();
    if (!(await options.evaluate((node) => (node as HTMLDetailsElement).open)))
      await options.locator('summary').click();
  }
}
export async function closePrepMenu(page: Page) {
  if (await page.locator('#prep-sidebar').isVisible())
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
}
export async function precisePlacement(page: Page) {
  const options = page.locator('#placement-precise');
  if (!(await options.evaluate((node) => (node as HTMLDetailsElement).open)))
    await options.locator('summary').click();
}
export async function battleTools(page: Page) {
  if (!(await page.locator('#battle-tools-sheet').isVisible()))
    await page.locator('#battle-tools').click();
}
