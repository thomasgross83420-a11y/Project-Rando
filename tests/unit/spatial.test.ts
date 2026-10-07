import { it, expect } from 'vitest';
import { SpatialIndex } from '../../src/sim/spatial';
import { U } from '../../src/sim/fixed';
import { sweep } from '../../src/sim/collision';
it('2GU broad phase never omits a swept contact and keeps stable IDs after movement/death', () => {
  const shapes = Array.from({ length: 120 }, (_, i) => ({
    id: i + 1,
    hp: U,
    x: (((i * 17) % 55) + 2) * U,
    y: (((i * 23) % 55) + 2) * U,
    radius: 358,
    rect:
      i % 7 === 0
        ? {
            x: (((i * 17) % 55) + 2) * U,
            y: (((i * 23) % 55) + 2) * U,
            width: 2 * U,
            height: 2 * U,
          }
        : null,
  }));
  const index = new SpatialIndex<(typeof shapes)[number]>();
  index.rebuild(shapes);
  for (let i = 0; i < 50; i++) {
    const a = { x: (i % 60) * U, y: ((i * 17) % 60) * U },
      b = { x: ((i * 29) % 60) * U, y: ((i * 3) % 60) * U },
      candidates = index.query(a, b, 51),
      hits = shapes.filter((e) => sweep(a, b, e) !== null);
    for (const hit of hits) expect(candidates.some((e) => e.id === hit.id)).toBe(true);
    expect(candidates.map((e) => e.id)).toEqual(candidates.map((e) => e.id).sort((a, b) => a - b));
  }
  const e = shapes[0];
  if (!e) throw new Error('Fixture');
  e.x = 60 * U;
  e.rect = null;
  index.update(e);
  expect(index.query(e, e, 358).some((t) => t.id === e.id)).toBe(true);
  e.hp = 0;
  index.update(e);
  expect(index.query(e, e, 358).some((t) => t.id === e.id)).toBe(false);
});
