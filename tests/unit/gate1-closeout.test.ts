import { expect, test } from 'vitest';
import { analyzeRoutes, edgeClear, CORE } from '../../src/construction/geometry';
import {
  fit as fitField,
  fitBase,
  project,
  unproject,
  pan,
  type Camera,
} from '../../src/render/projection';
import { preferencesSchema } from '../../src/persistence/preferences';
test('Base and Field fit are distinct in all views; rotation fit preserves world inverse and panning reaches staging', () => {
  for (const view of [0, 1, 2, 3] as const) {
    const camera: Camera = { x: 30, y: 30, zoom: 1, view, width: 800, height: 640 };
    fitBase(camera);
    const base = camera.zoom;
    expect(base).toBeGreaterThanOrEqual(0.35);
    for (const point of [
      { x: 12, y: 12 },
      { x: 48, y: 48 },
      { x: 30, y: 30 },
    ]) {
      const p = project(point, camera);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(camera.width);
      expect(unproject(p, camera).x).toBeCloseTo(point.x, 8);
    }
    fitField(camera);
    expect(camera.zoom).toBeLessThan(base);
    pan(camera, 400, -240);
    expect(camera.x === 30 && camera.y === 30).toBe(false);
  }
});
test('route overlay witnesses use the same continuous radius clearance as legality, including ground boss fixture', () => {
  const solids = [
    { x: 24, y: 26, width: 2, height: 2 },
    { x: 25, y: 32, width: 1, height: 1 },
  ];
  const report = analyzeRoutes(solids, [461, 768, 1229]);
  expect(report.failure).toBeUndefined();
  expect(report.traces).toHaveLength(18);
  const fixed = [CORE, ...solids].map((r) => ({
    x: r.x * 1024,
    y: r.y * 1024,
    width: r.width * 1024,
    height: r.height * 1024,
  }));
  for (const trace of report.traces) {
    expect(trace.valid).toBe(true);
    expect(trace.points.length).toBeGreaterThan(1);
    for (let i = 1; i < trace.points.length; i++) {
      const a = trace.points[i - 1],
        b = trace.points[i];
      if (!a || !b) throw new Error('Route witness point missing');
      expect(
        edgeClear(
          { x: Math.round(a.x * 1024), y: Math.round(a.y * 1024) },
          { x: Math.round(b.x * 1024), y: Math.round(b.y * 1024) },
          trace.radius,
          fixed,
        ),
      ).toBe(true);
    }
  }
  const blocked = analyzeRoutes([
    { x: 26, y: 26, width: 8, height: 1 },
    { x: 26, y: 33, width: 8, height: 1 },
    { x: 26, y: 27, width: 1, height: 6 },
    { x: 33, y: 27, width: 1, height: 6 },
  ]);
  expect(blocked.failure).toContain('Entrance 1');
  expect(blocked.traces.every((t) => !t.valid && t.points.length <= 1)).toBe(true);
});
test('preferences accept implemented presentation fields only, reject unknown and unsafe scale values', () => {
  expect(
    preferencesSchema.parse({ schema: 1, uiScale: 36, reducedEffects: true, highContrast: true })
      .highContrast,
  ).toBe(true);
  expect(() =>
    preferencesSchema.parse({ schema: 1, uiScale: 42, reducedEffects: true, highContrast: false }),
  ).toThrow();
  expect(() =>
    preferencesSchema.parse({
      schema: 1,
      uiScale: 18,
      reducedEffects: true,
      highContrast: false,
      credits: 9999,
    }),
  ).toThrow();
});

test('capacity accepts exactly20 and rejects22 without charging or changing ownership', async () => {
  const { createCampaign, applyCommand, accounting } = await import(
    '../../src/persistence/campaign'
  );
  let campaign = createCampaign('Capacity', 0, 'Bastion', 'warden.bulwark');
  campaign.credits = 4000;
  for (let i = 0; i < 10; i++)
    campaign = applyCommand(campaign, {
      kind: 'buy-place',
      type: 'friendly.sentry',
      x: 12 + i * 2,
      y: 12,
      rotation: 0,
    });
  expect(accounting(campaign).capacity).toBe(20);
  const before = structuredClone(campaign);
  expect(() =>
    applyCommand(campaign, {
      kind: 'buy-place',
      type: 'friendly.sentry',
      x: 12,
      y: 16,
      rotation: 0,
    }),
  ).toThrow(/capacity/);
  expect(campaign).toEqual(before);
});
