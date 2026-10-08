import { expect, test } from '@playwright/test';

test('preparation and legal/illegal Rifle ghosts share the authored three-member art without loading the legacy combat atlas', async ({
  page,
}) => {
  await page.route('**/Project-Rando/__rifle-preparation', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Rifle preparation test</title>',
    }),
  );
  await page.goto('/Project-Rando/__rifle-preparation');
  await page.addScriptTag({ path: '.cache/render-reuse-browser/fixture.js' });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'width:780px;height:740px';
    document.body.append(host);
    window.RBMeasuredWorld = new window.RBRenderFixture.WorldView(host, () => {});
  });
  await expect.poll(() => page.evaluate(() => window.RBMeasuredWorld.ready)).toBe(true);
  const result = await page.evaluate(() => {
    const v = window.RBMeasuredWorld;
    v.campaign = window.RBRenderFixture.deployedCampaign();
    const rifle = v.campaign.assets.find((a) => a.type === 'friendly.rifle_squad');
    if (!rifle) throw Error('Rifle fixture missing');
    Object.assign(v.camera, { x: 30, y: 30, zoom: 2, view: 0 });
    const saved = JSON.stringify(v.campaign);
    const samples = [];
    for (const view of [0, 1, 2, 3] as const)
      for (const valid of [true, false]) {
        v.camera.view = view;
        v.ghost = { type: 'friendly.rifle_squad', x: 25, y: 25, rotation: 0, valid };
        v.draw();
        const members = v.sprites.filter((i) =>
          String(i.frame.name).startsWith('friendly.rifle_squad.'),
        );
        samples.push({
          members: members.length,
          frames: [...new Set(members.map((i) => String(i.frame.name)))],
          ghosts: members.filter((i) => i.alpha === 0.6).length,
          hits: v.hitRecords.filter((h) => h.id === rifle.id).length,
        });
      }
    return {
      samples,
      legacyAtlas: v.scene!.textures.exists('combat.0'),
      unchanged: JSON.stringify(v.campaign) === saved,
    };
  });
  expect(result.legacyAtlas).toBe(false);
  expect(result.unchanged).toBe(true);
  for (const sample of result.samples) {
    expect(sample.members).toBe(6);
    expect(sample.frames).toHaveLength(1);
    expect(sample.ghosts).toBe(3);
    expect(sample.hits).toBe(1);
  }
});

test('Rifle moving fire uses three grounded members, independent gait/aim, one cropped rig per member and repeatable pixels through pause and camera rotation', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.route('**/Project-Rando/__rifle-review', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>Rifle animation test</title>',
    }),
  );
  await page.goto('/Project-Rando/__rifle-review');
  await page.addScriptTag({ path: '.cache/render-reuse-browser/fixture.js' });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'rifle-review';
    host.style.cssText = 'width:780px;height:740px;background:#26343e';
    document.body.append(host);
    window.RBMeasuredWorld = new window.RBRenderFixture.WorldView(host, () => {}, true);
  });
  await expect.poll(() => page.evaluate(() => window.RBMeasuredWorld.ready)).toBe(true);
  const results = await page.evaluate(async () => {
    const { Battle, CombatRenderer } = window.RBRenderFixture;
    const b = await Battle.create([
      {
        uuid: '00000000-0000-4000-8000-000000000003',
        type: 'friendly.rifle_squad',
        heading: 0,
        x: 23,
        y: 28,
        width: 2,
        height: 2,
        hp: 900 * 1024,
      },
    ]);
    const e = b.entities.find((e) => e.type === 'friendly.rifle_squad')!;
    const r = new CombatRenderer(window.RBMeasuredWorld),
      v = window.RBMeasuredWorld;
    Object.assign(v.camera, { x: 26, y: 29, zoom: 2.5, view: 0 });
    v.fitActive = false;
    v.draw();
    r.motion.observe(b.entities, 0);
    b.tick = 1;
    e.x += 38;
    e.lastMove = 1;
    e.lastAction = 1;
    e.lastRelease = 1;
    e.heading = 0;
    r.motion.observe(b.entities, 1);
    const snapshots = [];
    for (const view of [0, 1, 2, 3] as const) {
      v.camera.view = view;
      v.draw();
      r.draw(b);
      const actors = [...r.images.entries()].filter(([k]) => k.startsWith(`actor.${e.id}.`));
      const upper = actors.filter(([k]) => !k.endsWith('.lower'));
      const lower = actors.filter(([k]) => k.endsWith('.lower'));
      snapshots.push({
        view,
        actors: actors.length,
        attackMembers: upper.filter(([, i]) => String(i.frame.name).includes('.attack.')).length,
        upperFaces: upper.map(([, i]) => String(i.frame.name).split('.')[2]),
        lowerFaces: lower.map(([, i]) => String(i.frame.name).split('.')[2]),
        cropped: actors.every(([, i]) => i.isCropped),
        hitCount: v.hitRecords.filter((h) => h.id === String(e.id)).length,
      });
    }
    v.camera.view = 0;
    v.draw();
    r.draw(b);
    const before = JSON.stringify(b.snapshot());
    for (let i = 0; i < 30; i++) r.draw(b);
    if (JSON.stringify(b.snapshot()) !== before) throw Error('Presentation mutated battle');
    // Retain only in the isolated measurement page, never in the application.
    Object.assign(window, { RBRifleReview: { battle: b, renderer: r } });
    return snapshots;
  });
  for (const s of results) {
    expect(s.actors).toBe(6);
    expect(s.attackMembers).toBe(1);
    expect(s.cropped).toBe(true);
    expect(s.hitCount).toBe(1);
    expect(s.upperFaces[0]).not.toBe(s.lowerFaces[0]);
  }
  await page.waitForTimeout(120);
  const before = await page
    .locator('#rifle-review canvas')
    .screenshot({ path: 'test-results/rifle-moving-fire.png' });
  await page.evaluate(() => {
    const { battle, renderer } = (
      window as unknown as {
        RBRifleReview: {
          battle: import('../../src/sim/battle').Battle;
          renderer: import('../../src/render/combat').CombatRenderer;
        };
      }
    ).RBRifleReview;
    const v = window.RBMeasuredWorld;
    for (let i = 0; i < 16; i++) {
      v.camera.view = (i % 4) as 0 | 1 | 2 | 3;
      v.draw();
      renderer.draw(battle);
    }
    v.camera.view = 0;
    v.draw();
    renderer.draw(battle);
  });
  await page.waitForTimeout(120);
  expect((await page.locator('#rifle-review canvas').screenshot()).equals(before)).toBe(true);
});
