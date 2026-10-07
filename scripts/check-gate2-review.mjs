import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1280 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.RB_REVIEW_URL ?? 'http://127.0.0.1:4180/');
  const images = page.locator('img');
  for (let i = 0; i < (await images.count()); i++) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((e) => e.decode());
  }
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.focus();
  await checkbox.press('Space');
  if (!(await checkbox.isChecked())) throw new Error('Keyboard review checkbox failed');
  for (const viewport of [
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error('Review overflow');
  }
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log(
    JSON.stringify({
      images: await images.count(),
      audio: await page.locator('audio').count(),
      keyboard: true,
      overflow: false,
      errors,
      source: 'Local HTTP review inspection; not public deployment or Android file support',
    }),
  );
} finally {
  await browser.close();
}
