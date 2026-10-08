import { battleTools, prepMenu } from './menu-helpers';
import { expect, test } from '@playwright/test';
test('injected background pauses without catch-up; keyboard audio settings persist through checkpoint reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto('./');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Accessibility fixture');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await prepMenu(page, 'siege');
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
  await battleTools(page);
  await page.locator('#battle-camera').click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  await expect(page.locator('#battle-root')).toHaveAttribute('data-audio-state', 'suspended');
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege');
  await expect(page.locator('#battle-root')).toHaveAttribute('data-audio-state', 'running');
  // Headless Chromium keeps native tabs visible. Inject only the visibility condition,
  // then exercise the actual listener, scheduler, Resume guard and UI. This is not OS evidence.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Paused');
  const tick = await page.locator('#battle-root').getAttribute('data-tick');
  await page.waitForTimeout(300);
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(tick);
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#battle-status')).toContainText('Resume unavailable');
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  expect(await page.locator('#battle-root').getAttribute('data-tick')).toBe(tick);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Audio Settings', exact: true }).click();
  const master = page.getByLabel('Master volume', { exact: true });
  await master.focus();
  await master.press('Home');
  for (let i = 0; i < 4; i++) await master.press('ArrowRight');
  await expect(master).toHaveValue('4');
  await page.getByLabel('Mute all', { exact: true }).check();
  await page.getByRole('button', { name: 'Back to Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel / close', exact: true }).click();
  await expect(page.locator('#status')).toHaveText(
    'Presentation preferences saved. Campaign data unchanged.',
  );
  await expect(page.locator('#status')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Take Over Editing', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Restart From Checkpoint', exact: true }).click();
  await expect(page.locator('#battle-root')).toHaveAttribute('data-state', 'Siege', {
    timeout: 20000,
  });
  await battleTools(page);
  await expect(page.locator('#battle-mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Audio Settings', exact: true }).click();
  await expect(master).toHaveValue('4');
  await expect(page.getByLabel('Mute all', { exact: true })).toBeChecked();
});
