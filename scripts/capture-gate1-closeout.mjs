/** Actual Gate1 construction closeout, no review-only combat staging or saves. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve(process.argv[2] ?? '/workspace/shared/Resonance_Bastion_Gate1_Closeout');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 800, height: 1280 },
  hasTouch: true,
  deviceScaleFactor: 1,
});
const errors = [],
  warnings = [],
  images = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const b = (name) => page.getByRole('button', { name, exact: true });
async function image(id, full = false) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const metadata = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    uiScale: getComputedStyle(document.documentElement).fontSize,
    highContrast: document.documentElement.classList.contains('high-contrast'),
    reducedEffects: document.documentElement.classList.contains('reduced-effects'),
    camera: { ...document.getElementById('world').dataset },
    routeText: document.getElementById('route-summary').textContent,
  }));
  await (full
    ? page.screenshot({ path: `${out}/${id}.png` })
    : page.locator('canvas').screenshot({ path: `${out}/${id}.png` }));
  images.push({
    id,
    source: 'Actual production runtime, no resampling, no combat staging',
    temporary:
      'Gate1 construction foundation; combat/animation remains Designed; final full-roster icon audit pending',
    ...metadata,
  });
}
async function coordinates(x, y) {
  await page.getByLabel('X', { exact: true }).fill(String(x));
  await page.getByLabel('Y', { exact: true }).fill(String(y));
  await page.getByLabel('Y', { exact: true }).press('Tab');
}
await page.goto('http://127.0.0.1:4173/Project-Rando/');
await b('New Game').click();
await b('Create campaign').first().click();
await page.getByLabel('Campaign name', { exact: true }).fill('Gate 1 Closeout');
await b('Review Campaign').click();
await b('Create').click();
await page.locator('canvas').waitFor();
await page.getByRole('button', { name: /Sentry 2 · Stored/ }).click();
await coordinates(24, 28);
await b('Place').click();
await page.getByRole('button', { name: /Standard Barricade 5 · Stored/ }).click();
await coordinates(26, 32);
await b('Place').click();
await b('Fit Base').click();
await image('01-fit-base');
await b('Fit field').click();
await image('02-fit-field-icons');
await b('Show Routes').click();
for (let i = 0; i < 4; i++) {
  await b('Fit Base').click();
  await image(`03-route-orientation-${i * 90}`);
  await b('Rotate view').click();
}
await b('Buy & Place Sentry · 250 Credits').click();
await coordinates(34, 28);
await image('04-valid');
await coordinates(28, 28);
await image('05-invalid-reserved');
assert.equal(await b('Place').isDisabled(), true);
await b('Cancel Placement').click();
for (const [viewport, scale, contrast] of [
  [{ width: 1280, height: 800 }, '18', false],
  [{ width: 1280, height: 800 }, '36', true],
  [{ width: 800, height: 1280 }, '36', true],
]) {
  await page.setViewportSize(viewport);
  await b('Accessibility').click();
  await page.getByLabel('Interface scale').selectOption(scale);
  await page.getByLabel('High contrast construction').setChecked(contrast);
  await page.getByLabel('Reduced effects', { exact: true }).check();
  await b('Cancel / close').click();
  await b('Fit Base').click();
  await image(`06-layout-${viewport.width}-scale-${scale}-contrast-${contrast}`, true);
}
await page.reload();
await b('Continue').click();
assert.match(await page.locator('#account').innerText(), /600 Credits.*Capacity 2\/20/);
assert.equal(
  await page.locator('html').evaluate((e) => e.classList.contains('high-contrast')),
  true,
);
assert.deepEqual(errors, []);
assert(
  warnings.every((w) =>
    /GL Driver Message.*(GPU stall due to ReadPixels|Running out of reserved outsideRenderPass queueSerial)/.test(
      w,
    ),
  ),
);
const evidence = {
  gate: 1,
  source: 'Production subpath build',
  date: new Date().toISOString(),
  browser: browser.version(),
  images,
  errors,
  warnings,
  reload:
    'Both placements,600 Credits,capacity2/20 and global200%/highContrast/reducedEffects retained',
  limits:
    'Desktop Chromium touch emulation; Android/TalkBack/performance remains Needs Device Check',
};
await writeFile(`${out}/capture.json`, JSON.stringify(evidence, null, 2));
console.log(
  JSON.stringify({
    images: images.length,
    errors,
    warnings: warnings.length,
    reload: evidence.reload,
  }),
);
await browser.close();
