import { expect, test, type Page } from '@playwright/test';
import type { WorldView } from '../../src/render/world';
declare global {
  interface Window {
    RBRenderFixture: typeof import('../../scripts/render-performance-fixture');
    RBMeasuredWorld: WorldView;
  }
}
async function world(page: Page) {
  await page.route('**/Project-Rando/__render-audit', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>Render test</title>',
    }),
  );
  await page.goto('/Project-Rando/__render-audit');
  await page.addScriptTag({ path: '.cache/render-reuse-browser/fixture.js' });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'measurement-world';
    host.style.cssText = 'width:800px;height:700px;';
    document.body.append(host);
    window.RBMeasuredWorld = new window.RBRenderFixture.WorldView(host, () => {}, true);
  });
  await expect.poll(() => page.evaluate(() => window.RBMeasuredWorld.ready)).toBe(true);
  await page.evaluate(() => {
    const v = window.RBMeasuredWorld;
    v.campaign = window.RBRenderFixture.deployedCampaign();
    window.RBRenderFixture.fitBase(v.camera);
    v.draw();
  });
}
test('repeated pan/zoom/facing/ghost cycles keep a bounded pool and hide surplus without changing picking', async ({
  page,
}) => {
  test.setTimeout(60000);
  await world(page);
  const result = await page.evaluate(() => {
    const v = window.RBMeasuredWorld;
    if (!v.scene) throw new Error('Scene missing');
    let images = 0,
      texts = 0,
      deaths = 0;
    const image = v.scene.add.image.bind(v.scene.add),
      text = v.scene.add.text.bind(v.scene.add);
    for (const n of v.scene.children.list) n.once('destroy', () => deaths++);
    v.scene.add.image = (...args) => {
      images++;
      const n = image(...args);
      n.once('destroy', () => deaths++);
      return n;
    };
    v.scene.add.text = (...args) => {
      texts++;
      const n = text(...args);
      n.once('destroy', () => deaths++);
      return n;
    };
    const cycle = () => {
      let wrongVisibility = false;
      for (let i = 0; i < 64; i++) {
        Object.assign(v.camera, {
          view: i % 4,
          x: 26 + (i % 9),
          y: 30,
          zoom: [0.4, 0.9, 1.8, 2.5][i % 4],
        });
        v.fitActive = false;
        v.highContrast = i % 2 === 0;
        v.ghost =
          i % 3 === 0
            ? { type: 'friendly.sentry', x: 23, y: 25, rotation: i % 4, valid: i % 2 === 0 }
            : undefined;
        v.draw();
        const active = new Set<unknown>([...v.sprites, ...v.labels]);
        for (const n of v.scene!.children.list) {
          if ('texture' in n && 'visible' in n && Boolean(n.visible) !== active.has(n))
            wrongVisibility = true;
        }
      }
      return {
        images,
        texts,
        deaths,
        children: v.scene!.children.list.length,
        hits: structuredClone(v.hitRecords),
        wrongVisibility,
      };
    };
    return { first: cycle(), second: cycle() };
  });
  expect(result.second.images).toBe(result.first.images);
  expect(result.second.texts).toBe(result.first.texts);
  expect(result.second.children).toBe(result.first.children);
  expect(result.second.deaths).toBe(0);
  expect(result.first.wrongVisibility || result.second.wrongVisibility).toBe(false);
  expect(result.second.hits).toEqual(result.first.hits);
});
test('ghost/role/label state clears back to identical pixels and scene disposal releases retained objects', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await world(page);
  await page.waitForTimeout(160);
  const before = await page.locator('#measurement-world canvas').screenshot();
  await page.evaluate(() => {
    const v = window.RBMeasuredWorld,
      camera = { ...v.camera };
    for (let i = 0; i < 16; i++) {
      Object.assign(v.camera, { zoom: i % 2 ? 2.5 : 0.4, view: i % 4 });
      v.ghost = { type: 'friendly.sentry', x: 23, y: 25, rotation: i % 4, valid: i % 2 === 0 };
      v.highContrast = i % 2 === 0;
      v.draw();
    }
    Object.assign(v.camera, camera);
    v.ghost = undefined;
    v.highContrast = false;
    v.draw();
  });
  await page.waitForTimeout(160);
  expect((await page.locator('#measurement-world canvas').screenshot()).equals(before)).toBe(true);
  const retained = await page.evaluate(() => window.RBMeasuredWorld.scene!.children.list.length);
  expect(retained).toBeGreaterThan(100);
  await page.evaluate(() => window.RBMeasuredWorld.dispose());
  await expect(page.locator('#measurement-world canvas')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      images: window.RBMeasuredWorld.sprites.length,
      labels: window.RBMeasuredWorld.labels.length,
    })),
  ).toEqual({ images: 0, labels: 0 });
});
