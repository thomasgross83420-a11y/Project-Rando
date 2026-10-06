import { describe, expect, test } from 'vitest';
import { HeadlessFixture, RandomStream, roundFixed } from '../../src/sim/determinism';
import { clientPoint, project, unproject, zoomAt, type Camera } from '../../src/render/projection';
describe('T06 projection and input', () => {
  test('four orientations, all zoom classes and target viewport sizes roundtrip', () => {
    for (const [width, height] of [
      [360, 640],
      [412, 915],
      [800, 1280],
      [1280, 800],
    ])
      for (const view of [0, 1, 2, 3] as const)
        for (const zoom of [0.15, 0.35, 0.65, 1, 1.35, 2.5]) {
          if (!width || !height) throw new Error('Viewport fixture missing');
          const camera: Camera = { x: 30, y: 30, width, height, view, zoom };
          for (const point of [
            { x: 0, y: 0 },
            { x: 59.99, y: 59.99 },
            { x: 29, y: 34 },
            { x: 12, y: 47 },
          ]) {
            const q = unproject(project(point, camera), camera);
            expect(q.x).toBeCloseTo(point.x, 9);
            expect(q.y).toBeCloseTo(point.y, 9);
          }
          const pixel = { x: width * 0.2, y: height * 0.7 },
            before = unproject(pixel, camera);
          zoomAt(camera, 1.4, pixel);
          expect(unproject(pixel, camera).x).toBeCloseTo(before.x, 9);
          expect(unproject(pixel, camera).y).toBeCloseTo(before.y, 9);
        }
  });
  test('CSS resize maps pointer without DPR assumptions', () => {
    const camera: Camera = { x: 30, y: 30, width: 800, height: 400, view: 2, zoom: 1 };
    expect(
      clientPoint({ x: 220, y: 130 }, { left: 20, top: 30, width: 400, height: 200 }, camera),
    ).toEqual({ x: 400, y: 200 });
  });
});
describe('T02/T03 deterministic mechanism', () => {
  test('pinned xorshift32 vectors and exact movement carry', () => {
    const stream = new RandomStream(1);
    expect([stream.next(), stream.next(), stream.next()]).toEqual([270369, 67634689, 2647435461]);
    const world = new HeadlessFixture(new RandomStream(1));
    for (let i = 0; i < 60; i++) world.step();
    expect(world.x).toBe(2253);
    expect(world.carry).toBe(0);
    expect(roundFixed(-1.5)).toBe(-2);
    expect(roundFixed(1.5)).toBe(2);
    expect(() => roundFixed(Number.NaN)).toThrow();
  });
});
