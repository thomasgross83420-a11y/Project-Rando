import './build-render-fixture.mjs';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Choose before or after');
const out = `/workspace/scratch/render-reuse-${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const errors = [];
const reports = [];
const cases = [
  ['portrait-base', 800, 1280, 800, 900, 'base', false],
  ['portrait-field', 800, 1280, 800, 900, 'field', false],
  ['portrait-close', 800, 1280, 800, 900, 'close', false],
  ['portrait-ghost', 800, 1280, 800, 900, 'base', true],
  ['landscape-field', 1280, 800, 1200, 500, 'field', false],
  ['landscape-close', 1280, 800, 1200, 500, 'close', true],
];
try {
  for (const [name, width, height, worldWidth, worldHeight, mode, ghost] of cases) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    // A separate document avoids interfering with the app's async bootstrap.
    await page.route('**/Project-Rando/__render-audit', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><meta charset="utf-8"><title>Render audit</title>',
      }),
    );
    await page.goto('http://127.0.0.1:4173/Project-Rando/__render-audit');
    await page.addScriptTag({ path: '.cache/render-reuse-browser/fixture.js' });
    const report = await page.evaluate(
      async ({ worldWidth, worldHeight, mode, ghost }) => {
        const f = window.RBRenderFixture;
        const host = document.createElement('div');
        host.id = 'measurement-world';
        host.style.cssText = `width:${worldWidth}px;height:${worldHeight}px;max-width:none;`;
        document.body.replaceChildren(host);
        const view = new f.WorldView(
          host,
          (message) => {
            throw new Error(message);
          },
          true,
        );
        await new Promise((resolve, reject) => {
          const deadline = performance.now() + 30000;
          const check = () => {
            if (view.ready) resolve();
            else if (performance.now() > deadline) reject(new Error('World did not initialize'));
            else requestAnimationFrame(check);
          };
          check();
        });
        view.campaign = f.deployedCampaign();
        view.fitActive = mode !== 'close';
        view.fitMode = mode === 'field' ? 'field' : 'base';
        if (mode === 'field') f.fit(view.camera);
        else if (mode === 'base') f.fitBase(view.camera);
        else Object.assign(view.camera, { x: 30, y: 30, zoom: 2, view: 0 });
        if (ghost) view.ghost = { type: 'friendly.sentry', x: 23, y: 25, rotation: 1, valid: true };
        view.draw();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        let imagesCreated = 0,
          textsCreated = 0,
          destroyed = 0;
        const watch = (node) => {
          node.once('destroy', () => destroyed++);
          return node;
        };
        for (const node of view.scene.children.list) watch(node);
        const originalImage = view.scene.add.image.bind(view.scene.add);
        view.scene.add.image = (...args) => {
          imagesCreated++;
          return watch(originalImage(...args));
        };
        const originalText = view.scene.add.text.bind(view.scene.add);
        view.scene.add.text = (...args) => {
          textsCreated++;
          return watch(originalText(...args));
        };
        const timings = [];
        // Four complete camera cycles repeat the exact same viewpoints.
        for (let cycle = 0; cycle < 4; cycle++) {
          for (let facing = 0; facing < 4; facing++) {
            view.camera.view = facing;
            for (let repetition = 0; repetition < 5; repetition++) {
              await new Promise((resolve) => requestAnimationFrame(resolve));
              const start = performance.now();
              view.draw();
              timings.push(performance.now() - start);
            }
          }
        }
        view.camera.view = 0;
        view.draw();
        const final = {
          activeImages: view.sprites.length,
          activeTexts: view.labels.length,
          sceneChildren: view.scene.children.list.length,
          visibleChildren: view.scene.children.list.filter((n) => n.visible).length,
          hits: view.hitRecords,
          camera: { ...view.camera },
        };
        const sorted = [...timings].sort((a, b) => a - b);
        const gl = view.game.renderer.gl;
        return {
          draws: timings.length + 1,
          imagesCreated,
          textsCreated,
          destroyed,
          meanMs: timings.reduce((a, b) => a + b, 0) / timings.length,
          medianMs: sorted[Math.floor(sorted.length / 2)],
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
          maximumMs: sorted[sorted.length - 1],
          features: {
            secureContext: isSecureContext,
            bigint: typeof BigInt === 'function',
            structuredClone: typeof structuredClone === 'function',
            objectHasOwn: typeof Object.hasOwn === 'function',
            randomUUID: typeof crypto.randomUUID === 'function',
            indexedDB: typeof indexedDB === 'object',
            pointerEvents: typeof PointerEvent === 'function',
            webAudio: typeof AudioContext === 'function',
            webGL: Boolean(gl),
            gpuRenderer: gl?.getParameter(gl.RENDERER),
            userAgent: navigator.userAgent,
          },
          final,
        };
      },
      { worldWidth, worldHeight, mode, ghost },
    );
    await page.waitForTimeout(160);
    const screenshot = `${out}/${name}.png`;
    await page.locator('#measurement-world canvas').screenshot({ path: screenshot });
    report.screenshotSHA256 = createHash('sha256')
      .update(await readFile(screenshot))
      .digest('hex');
    reports.push({ name, viewport: { width, height }, ...report });
    await context.close();
  }
} finally {
  await browser.close();
}
if (errors.length) throw new Error(JSON.stringify(errors));
const result = {
  phase,
  date: '2026-10-08',
  engine: 'desktop Chromium; actual shared WorldView class',
  limitations: [
    'Not Lenovo/Android performance',
    'JavaScript draw submission time, not GPU frame time',
    'Loopback context, not deployed HTTPS acceptance',
    'Teaching-slice preparation/background, not maximum-roster combat',
  ],
  errors,
  cases: reports,
};
await writeFile(
  `docs/evidence/RENDER_REUSE_${phase.toUpperCase()}.json`,
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    reports.map(({ name, imagesCreated, textsCreated, destroyed, medianMs, p95Ms }) => ({
      name,
      imagesCreated,
      textsCreated,
      destroyed,
      medianMs,
      p95Ms,
    })),
    null,
    2,
  ),
);
