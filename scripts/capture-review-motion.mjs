import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = process.env.RB_REVIEW_DIR ?? '/workspace/shared/Resonance_Bastion_Gate2';
await mkdir(`${out}/motion-source`, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 1280 },
    hasTouch: true,
    deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/motion-source`, size: { width: 800, height: 1280 } },
  });
  const page = await context.newPage();
  const video = page.video();
  const errors = [];
  const samples = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.RB_CAPTURE_URL ?? 'http://127.0.0.1:4173/Project-Rando/');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Current Review');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await page.waitForSelector('#battle-speed');
  await page.locator('#battle-speed').selectOption('1');
  await page.locator('#battle-camera').click();
  await page.locator('[data-battle-camera="in"]').click();
  await page.locator('[data-battle-camera="in"]').click();
  await page.locator('#battle-close').click();
  const started = Date.now();
  while (Date.now() - started < 45000) {
    const state = await page.locator('#battle-root').getAttribute('data-state');
    samples.push({
      elapsedMs: Date.now() - started,
      state,
      tick: Number(await page.locator('#battle-root').getAttribute('data-tick')),
    });
    if (state === 'Paused') {
      await page.locator('#battle-speed').selectOption('1');
      await page.locator('#battle-pause').click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await page.waitForTimeout(1000);
  }
  if (errors.length) throw new Error(JSON.stringify(errors));
  if (!samples.some((s) => s.tick >= 1800))
    throw new Error(
      'Capture did not reach the authored Raider deployment; do not claim sufficient motion.',
    );
  const version = await browser.version();
  await context.close();
  await video.saveAs(`${out}/tutorial-live.webm`);
  await writeFile(
    `${out}/motion-capture.json`,
    JSON.stringify(
      {
        browser: version,
        source: 'Actual production preview; UI automation only, no injected combat state',
        viewport: { width: 800, height: 1280 },
        speed: '1x',
        samples,
        errors,
        sound: 'Browser video has no captured system audio; separate original WAVs provided',
        limits:
          'Desktop software rendering; not Android frame pacing, full-battle proof or creative approval',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ samples: samples.length, lastTick: samples.at(-1)?.tick, errors }));
} finally {
  await browser.close();
}
