import {
  sweep as originalSweep,
  nearest as originalNearest,
} from '../fixtures/collision-reference';
import { it, expect } from 'vitest';
import { divRound, ratioRound, FRACTION } from '../../src/sim/fixed';
import { intersectsRectangle, sweep, nearest } from '../../src/sim/collision';
it('safe ratio rounding matches BigInt including signs, half ties and precision boundaries', () => {
  for (let i = 0; i < 12000; i++) {
    const n = (((i * 42731) % 122881) - 61440) * FRACTION,
      d = (i % 61339) + 1;
    expect(ratioRound(n, d)).toBe(divRound(BigInt(n), BigInt(d)));
  }
  for (const n of [0, 1, -1, 7, -7, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])
    for (const d of [1, 2, 3, 500000, Number.MAX_SAFE_INTEGER])
      expect(ratioRound(n, d)).toBe(divRound(BigInt(n), BigInt(d)));
});
it('line-of-sight fast path agrees with the full sweep across field rays, edges and corner contacts', () => {
  for (let i = 0; i < 20000; i++) {
    const a = { x: (i * 42731) % 61441, y: (i * 17137) % 61441 },
      b = { x: (i * 27241 + 59999) % 61441, y: (i * 31237 + 127) % 61441 },
      r = {
        x: (i * 731) % 57000,
        y: (i * 2137) % 57000,
        width: ((i % 4) + 1) * 1024,
        height: ((i % 3) + 1) * 1024,
      };
    expect(intersectsRectangle(a, b, r)).toBe(
      sweep(a, b, { x: r.x, y: r.y, radius: 0, rect: r }, 0) !== null,
    );
  }
  for (const scale of [1, 3, 7, 1024, 61440])
    for (const t of [-2, -1, 0, 1, 2, 3, 4]) {
      const a = { x: 0, y: 0 },
        b = { x: scale, y: scale },
        r = { x: t, y: t, width: 1, height: 1 };
      expect(intersectsRectangle(a, b, r)).toBe(
        sweep(a, b, { ...a, radius: 0, rect: r }, 0) !== null,
      );
    }
});

it('conservative broad phase and nearest points preserve exact original contact fractions', () => {
  for (let i = 0; i < 16000; i++) {
    const a = { x: (i * 42731) % 61441, y: (i * 17137) % 61441 },
      b = { x: (i * 27241 + 59) % 61441, y: (i * 31237 + 127) % 61441 },
      r = {
        x: (i * 731) % 57000,
        y: (i * 2137) % 57000,
        width: ((i % 4) + 1) * 1024,
        height: ((i % 3) + 1) * 1024,
      };
    for (const rect of [null, r]) {
      const shape = { x: r.x, y: r.y, radius: (i % 5) * 137, rect },
        projectileRadius = i % 3 === 0 ? 0 : i % 3 === 1 ? 51 : 1024;
      expect(sweep(a, b, shape, projectileRadius)).toBe(
        originalSweep(a, b, shape, projectileRadius),
      );
      expect(nearest(a, shape)).toEqual(originalNearest(a, shape));
    }
  }
});
