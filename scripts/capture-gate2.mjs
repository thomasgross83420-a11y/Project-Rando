import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.RB_REVIEW_DIR ?? '/workspace/shared/Resonance_Bastion_Gate2';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
    viewport: { width: 800, height: 1280 },
    hasTouch: true,
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  errors = [],
  warnings = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
const captures = [];
async function capture(name, extra = '') {
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const camera = await page.locator('#battle-world').evaluate((e) => ({ ...e.dataset }));
  captures.push({
    name,
    viewport: page.viewportSize(),
    interfaceScale: await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
    simulationTick: await page.locator('#battle-root').getAttribute('data-tick'),
    camera,
    highContrast: await page.evaluate(() =>
      document.documentElement.classList.contains('high-contrast'),
    ),
    reducedEffects: await page.evaluate(() =>
      document.documentElement.classList.contains('reduced-effects'),
    ),
    source: 'Live runtime, original candidate sprites; native screenshot, no interpolation',
    temporary: 'Gate2 practice notice; current tutorial only; candidate animations',
    extra,
  });
}
async function camera(command) {
  await page.locator('#battle-camera').click();
  await page.locator(`[data-battle-camera="${command}"]`).click();
  await page.locator('#battle-close').click();
}
try {
  await page.goto(process.env.RB_CAPTURE_URL ?? 'http://127.0.0.1:5173/Project-Rando/');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Gate2 Runtime Review');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Tutorial Practice', exact: true }).click();
  await page.waitForSelector('#battle-speed');
  await page.locator('#battle-speed').selectOption('2');
  for (let i = 0; i < 100; i++) {
    const tick = Number(await page.locator('#battle-root').getAttribute('data-tick'));
    const runner = await page
      .locator('#battle-entity option')
      .evaluateAll((options) =>
        options.some((o) => o.textContent.includes('Hostile') && o.textContent.includes('Runner')),
      );
    if (tick >= 600 && runner) break;
    if (i === 99)
      throw new Error('No observed Runner reached the live review; do not reuse stale screenshots');
    if ((await page.locator('#battle-root').getAttribute('data-state')) === 'Paused') {
      await page.locator('#battle-speed').selectOption('1');
      await page.locator('#battle-pause').click();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await page.waitForTimeout(500);
  }
  await page.locator('#battle-pause').click();
  await page.locator('#battle-close').click();
  await capture('01-fit-base');
  await camera('in');
  await capture('02-tactical');
  for (let i = 1; i < 4; i++) {
    await camera('rotate');
    await capture(`0${2 + i}-camera-${i * 90}`);
  }
  await camera('rotate');
  await page.locator('#battle-inspect').click();
  const hostile = await page
    .locator('#battle-entity option')
    .evaluateAll(
      (options) =>
        options.find((o) => o.textContent.includes('Hostile') && o.textContent.includes('body'))
          ?.value,
    );
  if (!hostile) throw new Error('Observed hostile missing; reject incomplete capture');
  if (hostile) {
    await page.locator('#battle-entity').selectOption(hostile);
    await page.locator('#battle-jump').click();
    await camera('in');
    await camera('in');
    await capture('06-close-hostile', `Observed hostile ${hostile}, no recolor`);
  }
  await camera('fit-base');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await page.locator('#battle-contrast').check();
  await page.locator('#battle-reduce').check();
  await page.locator('#battle-close').click();
  await capture('07-high-contrast-reduced');
  await page.setViewportSize({ width: 1280, height: 800 });
  await capture('08-landscape');
  await page.locator('#battle-pause').click();
  await page.getByRole('button', { name: 'Accessibility', exact: true }).click();
  await page.locator('#battle-ui-scale').selectOption('36');
  await page.locator('#battle-close').click();
  await capture('09-landscape-200');
  await page.setViewportSize({ width: 800, height: 1280 });
  await capture('10-portrait-200');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow || errors.length) throw new Error(JSON.stringify({ overflow, errors }));
  await writeFile(
    `${out}/runtime-capture.json`,
    JSON.stringify(
      { browser: await browser.version(), captures, errors, warnings, physicalAndroid: false },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ captures: captures.length, errors, overflow, warnings }));
} finally {
  await browser.close();
}
