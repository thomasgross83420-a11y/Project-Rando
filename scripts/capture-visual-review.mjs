/** Gate 1 user review. Read-only camera observation; art fixtures never enter saves.
 * Run after npm run build with npm run preview already listening on 4173.
 * Output belongs outside Git; no screenshots or local database are committed.
 */
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const out = resolve(process.argv[2] ?? '/workspace/shared/Resonance_Bastion_Gate1_Review');
await mkdir(`${out}/raw`, { recursive: true });
const assetFile = (await readdir('dist/assets')).find((f) => /^world-.*\.js$/.test(f));
assert(assetFile, 'Production WorldView module missing');
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 800, height: 1280 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  warnings = [],
  images = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
let stage = 'boot';
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${stage}: ${m.text()}`);
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const button = (name) => page.getByRole('button', { name, exact: true });
const temporary =
  'Candidate art; development header; unfinished terrain/role icons; static idle only.';
async function observe() {
  await page.evaluate(async (file) => {
    const module = await import(`/Project-Rando/assets/${file}`);
    const C = Object.values(module).find((c) => c?.prototype?.command && c?.prototype?.draw);
    if (!C) throw new Error('Production WorldView export missing');
    if (C.prototype.__reviewObserved) return;
    const original = C.prototype.draw;
    C.prototype.draw = function () {
      original.call(this);
      window.__reviewWorld = this;
    };
    C.prototype.__reviewObserved = true;
  }, assetFile);
}
async function metadata() {
  return page.evaluate(() => {
    const w = window.__reviewWorld;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      interfaceScale: `${Math.round((Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 18) * 100)}%`,
      camera: w && !document.querySelector('#preparation').hidden ? { ...w.camera } : null,
      mode: document.documentElement.classList.contains('reduced-effects')
        ? 'Reduced effects (no animated effects implemented); silent foundation (no music/SFX)'
        : 'Default; silent foundation (no music/SFX)',
      quality:
        'Only current baseline renderer; no quality selector or high-contrast mode implemented',
    };
  });
}
async function capture(
  id,
  title,
  { world = false, crop = false, fixture = false, scrollWorld = false, note = temporary } = {},
) {
  // Wait for a painted Phaser frame without using animation as gameplay timing.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  stage = id;
  const meta = await metadata();
  const path = `${out}/raw/${id}.png`;
  if (world) {
    const canvas = page.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    if (crop) {
      const box = await canvas.boundingBox();
      assert(box && box.width >= 520 && box.height >= 360);
      await page.screenshot({
        path,
        clip: {
          x: Math.round(box.x + (box.width - 520) / 2),
          y: Math.round(box.y + (box.height - 360) / 2),
          width: 520,
          height: 360,
        },
      });
    } else await canvas.screenshot({ path });
  } else {
    if (scrollWorld) await page.locator('canvas').scrollIntoViewIfNeeded();
    else await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path });
  }
  images.push({
    id,
    title,
    ...meta,
    source: fixture
      ? 'Live production renderer + explicitly staged, static atlas samples'
      : 'Live production runtime',
    crop: crop
      ? 'Central 520x360 CSS-pixel crop; no resampling'
      : world
        ? 'Canvas crop, no resampling'
        : 'Full viewport; additional controls may require scrolling',
    temporary: note,
    path: `raw/${id}.png`,
  });
}
async function coordinates(x, y) {
  await page.getByLabel('X', { exact: true }).fill(String(x));
  await page.getByLabel('Y', { exact: true }).fill(String(y));
  await page.getByLabel('Y', { exact: true }).press('Tab');
}
async function place(name, x, y) {
  await page.getByRole('button', { name }).first().click();
  await coordinates(x, y);
  assert(await button('Place').isEnabled());
  await button('Place').click();
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.startsWith('Saved:'),
  );
}
async function camera(command, count = 1) {
  for (let i = 0; i < count; i++) await button(command).click();
}
async function assertOverview() {
  const state = await page.evaluate(() => ({
    labels: window.__reviewWorld.labels
      .filter((l) => l.visible && !/^\d+$/.test(l.text))
      .map((l) => ({ name: l.text, ...l.getBounds() })),
    bodies: window.__reviewWorld.hitRecords,
    camera: { ...window.__reviewWorld.camera },
  }));
  const overlaps = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  assert.equal(state.labels.length, 3, 'Representative overview labels remain visible');
  for (let i = 0; i < state.labels.length; i++) {
    const l = state.labels[i];
    assert(
      l.x >= 0 &&
        l.y >= 0 &&
        l.x + l.width <= state.camera.width &&
        l.y + l.height <= state.camera.height,
    );
    for (const b of state.bodies) assert(!overlaps(l, b), `${l.name} covers artwork`);
    for (const other of state.labels.slice(i + 1))
      assert(!overlaps(l, other), 'Overview labels overlap');
  }
}
async function samples() {
  // These are presentation-only Image objects in the existing production scene.
  // No entity is spawned, no placement validation is bypassed, no save is edited.
  await page.evaluate(() => {
    const w = window.__reviewWorld;
    for (const [key, x, y] of [
      ['friendly.rifle_squad', 33, 29],
      ['enemy.runner', 34, 33],
    ]) {
      const view = w.camera.view,
        dx = x - w.camera.x,
        dy = y - w.camera.y;
      const [u, v] = [
        [dx, dy],
        [-dy, dx],
        [-dx, -dy],
        [dy, -dx],
      ][view];
      const footX = w.camera.width / 2 + 16 * w.camera.zoom * (u - v),
        footY = w.camera.height / 2 + 8 * w.camera.zoom * (u + v);
      const rifle = key.includes('rifle');
      const image = w.scene.add
        .image(footX, footY, 'foundation', `${key}.view${view}`)
        .setOrigin(rifle ? 48 / 96 : 24 / 48, rifle ? 66 / 80 : 54 / 64)
        .setScale(w.camera.zoom / 2);
      w.sprites.push(image);
    }
    // Merge static review samples into the same ground-foot ordering as real objects.
    const objects = w.sprites.filter((s) => !s.frame.name.startsWith('terrain.'));
    objects.sort(
      (a, b) =>
        a.y - b.y || a.x - b.x || String(a.frame.name).localeCompare(String(b.frame.name), 'en'),
    );
    objects.forEach((s, i) => {
      s.setDepth(1 + i);
    });
  });
}
try {
  await page.goto('http://127.0.0.1:4173/Project-Rando/');
  await page.waitForFunction(() => {
    const button = document.querySelector('#new-game');
    const art = document.querySelector('.title-art');
    return Boolean(button && !button.disabled && art?.complete && art.naturalWidth > 0);
  });
  await capture('01-title-portrait', 'Title / primary tablet');
  await button('New Game').click();
  await button('Create campaign').first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Gate 1 Visual Review');
  await button('Review Campaign').click();
  await button('Create').click();
  await page.locator('canvas').waitFor();
  await observe();
  await camera('Fit field');
  await place(/Sentry 2 · Stored/, 24, 28);
  await place(/Standard Barricade .* · Stored/, 26, 32);
  await capture(
    '02-preparation-portrait',
    'Preparation / current default orientation and Fit field',
  );
  for (let v = 0; v < 4; v++) {
    await assertOverview();
    if (v === 0)
      await capture('03-fit-field', 'Current Fit field overview (Fit Base not yet separate)', {
        world: true,
      });
    await camera('Rotate view');
  }
  checks.push(
    'No representative nameplate/nameplate or nameplate/body overlaps in all four overview views',
  );
  await camera('Zoom in', 4); // Exact zoom read from real camera, not guessed.
  for (let v = 0; v < 4; v++) {
    await capture(`04-orientation-${v * 90}`, `Camera ${v * 90} degrees / tactical`, {
      world: true,
      crop: true,
    });
    await camera('Rotate view');
  }
  await capture('05-tactical', 'Tactical zoom / real construction', { world: true, crop: true });
  await samples();
  await capture(
    '06-together',
    'Core, terrain, Sentry, Rifle, Runner and Barricade / actual runtime scale',
    {
      world: true,
      crop: true,
      fixture: true,
      note:
        temporary +
        ' Rifle/Runner are staged idle art, NOT deployed or combat-active; their additional views remain diagnostic.',
    },
  );
  await camera('Zoom in', 3);
  await capture('07-close', 'Close zoom / real construction', { world: true });
  await page.getByRole('button', { name: /Sentry 2 · at 24,28/ }).click();
  await coordinates(24, 28);
  assert(await button('Place').isEnabled());
  await capture('08-selected', 'Selected owned Sentry / free move preview', {
    world: true,
  });
  await button('Cancel Placement').click();
  await button('Buy & Place Sentry · 250 Credits').click();
  await coordinates(34, 28);
  assert(await button('Place').isEnabled());
  await capture('09-valid', 'Valid placement / tinted ghost and footprint', {
    world: true,
  });
  await page
    .locator('section[aria-label="Placement"]')
    .screenshot({ path: `${out}/raw/09-valid-controls.png` });
  images.push({
    id: '09-valid-controls',
    title: 'Valid placement / text, controls and route feedback',
    ...(await metadata()),
    source: 'Live production runtime',
    crop: 'Placement panel crop; no resampling',
    temporary: temporary,
    path: 'raw/09-valid-controls.png',
  });
  await coordinates(28, 28);
  assert(await button('Place').isDisabled());
  assert.match(await page.locator('#placement-reason').innerText(), /reserved/);
  await capture('10-invalid', 'Invalid placement / reserved Core precinct', {
    world: true,
  });
  await page
    .locator('section[aria-label="Placement"]')
    .screenshot({ path: `${out}/raw/10-invalid-controls.png` });
  images.push({
    id: '10-invalid-controls',
    title: 'Invalid placement / disabled Place and exact reason',
    ...(await metadata()),
    source: 'Live production runtime',
    crop: 'Placement panel crop; no resampling',
    temporary: temporary,
    path: 'raw/10-invalid-controls.png',
  });
  await button('Cancel Placement').click();
  await page
    .locator('section[aria-label="Owned inventory"]')
    .screenshot({ path: `${out}/raw/11-disabled-inventory.png` });
  images.push({
    id: '11-disabled-inventory',
    title: 'Disabled inventory actions / deployment Designed',
    ...(await metadata()),
    source: 'Live production runtime',
    crop: 'Owned inventory crop; no resampling',
    temporary:
      temporary +
      ' Disabled actions are unfinished deployments, NOT damaged or disabled battle assets.',
    path: 'raw/11-disabled-inventory.png',
  });
  checks.push(
    'Valid preview enables Place; Core-reserved preview disables Place with reason; previews do not spend credits',
  );
  assert.match(await page.locator('#account').innerText(), /600 Credits/);
  await page.reload();
  await button('Continue').click();
  await observe();
  await camera('Fit field');
  assert.match(await page.locator('#account').innerText(), /Capacity 2\/20/);
  assert(await page.getByRole('button', { name: /Sentry 2 · at 24,28/ }).count());
  assert(await page.getByRole('button', { name: /Standard Barricade .* · at 26,32/ }).count());
  checks.push(
    'Reload and Continue restore both placements, 600 Credits, capacity 2/20; previews do not persist',
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await camera('Fit field');
  await capture('12-preparation-landscape', 'Landscape preparation / current stacked layout', {
    scrollWorld: true,
  });
  await camera('Zoom in', 4);
  await capture('13-landscape-tactical', 'Landscape tactical / canvas', { world: true });
  await button('Return to title').click();
  await capture('14-title-landscape', 'Landscape title');
  await page.setViewportSize({ width: 800, height: 1280 });
  await button('Accessibility').click();
  await page.locator('#ui-scale').selectOption('36');
  await page.getByLabel('Reduced effects', { exact: true }).check();
  await capture('15-accessibility', 'Actual accessibility controls / 200%');
  await button('Cancel / close').click();
  await button('Continue').click();
  await camera('Fit field');
  await capture('16-preparation-200', '200% UI + reduced effects / primary tablet', {
    scrollWorld: true,
  });
  await button('Rotate view').focus();
  await page.keyboard.press('Tab');
  await page
    .locator('nav[aria-label="Camera controls"]')
    .screenshot({ path: `${out}/raw/17-camera-controls-200.png` });
  images.push({
    id: '17-camera-controls-200',
    title: '200% camera controls / non-drag alternatives',
    ...(await metadata()),
    source: 'Live production runtime',
    crop: 'Camera control panel crop; no resampling',
    temporary: temporary,
    path: 'raw/17-camera-controls-200.png',
  });
  for (const viewport of [
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      '200% horizontal reflow',
    );
    await button('Rotate view').focus();
    await page.keyboard.press('Enter');
    assert(
      await button('Rotate view').evaluate((e) => e === document.activeElement),
      'Focus retained after activation',
    );
    await assertOverview();
  }
  checks.push(
    '200% reflow without horizontal overflow at portrait/landscape tablets and 320px; focus and four-view labels remain usable',
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await camera('Fit field');
  await capture('18-landscape-200', '200% landscape / current stacked layout', {
    scrollWorld: true,
  });
  await writeFile(`${out}/capture-errors.json`, JSON.stringify({ errors, warnings }, null, 2));
  assert.deepEqual(errors, [], 'No browser errors or HTTP failures');
  assert(
    warnings.every((w) =>
      /GL Driver Message.*(?:GPU stall due to ReadPixels|Running out of reserved outsideRenderPass queueSerial\. ending renderPass now\.)/.test(
        w,
      ),
    ),
    'Unexpected browser warning',
  );
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify(
      {
        status: 'Awaiting User Review',
        date: new Date().toISOString(),
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
        buildAssets: await readdir('dist/assets'),
        atlasSHA256: createHash('sha256')
          .update(await readFile('public/assets/foundation.png'))
          .digest('hex'),
        browser: browser.version(),
        deviceScaleFactor: 1,
        images,
        checks,
        errors,
        warnings,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { images: images.length, checks, errors, warnings: warnings.length, output: out },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
