import { expect, it } from 'vitest';
import {
  grownRange,
  growthFactors,
  ordinaryIntervalTicks,
  scaleFixed,
} from '../../src/progression/growth';
import { rational } from '../../src/economy/policy';
import { levelUpBody } from '../../src/progression/allocation';
it('matches the blueprint Sentry discrete end-stat example with one fixed-point/tick rounding', () => {
  const f = growthFactors(100, 10);
  expect(scaleFixed(1200 * 1024, f.health)).toBe(2652 * 1024);
  expect(scaleFixed(40 * 1024, f.output)).toBe(85197);
  expect(grownRange(8 * 1024, 100, 10)).toBe(9421);
  expect(ordinaryIntervalTicks(rational(4n, 5n), 100)).toBe(38);
  expect(((85197 / 1024) * 60) / 38).toBeCloseTo(131.369, 3);
});
it('preserves beam/support cadence, aura-only additions and damage while forbidding premature enhancement tiers', () => {
  expect(ordinaryIntervalTicks(rational(1n, 10n), 100, 'beam')).toBe(6);
  expect(ordinaryIntervalTicks(rational(1n, 4n), 100, 'support')).toBe(15);
  expect(grownRange(5 * 1024, 100, 10, true)).toBe(6400);
  expect(grownRange(5 * 1024, 100, 10, false)).toBe(5888);
  expect(() => growthFactors(25, 3)).toThrow();
  expect(() => growthFactors(1, 1)).toThrow();
  const old = scaleFixed(1200 * 1024, growthFactors(1, 0).health),
    next = scaleFixed(1200 * 1024, growthFactors(2, 0).health);
  expect(levelUpBody(0, old, next)).toBe(0);
  expect(levelUpBody(old - 100 * 1024, old, next)).toBe(next - 100 * 1024);
});
it('keeps valid growth monotonic at every level and converts small positive durations to at least one tick', () => {
  let previous = 0;
  for (let level = 1; level <= 100; level++) {
    const maximum = scaleFixed(1200 * 1024, growthFactors(level, 0).health);
    expect(maximum).toBeGreaterThanOrEqual(previous);
    previous = maximum;
    for (let e = 0; e <= Math.floor(level / 10); e++) {
      const f = growthFactors(level, e);
      expect(scaleFixed(40 * 1024, f.output)).toBeGreaterThanOrEqual(40 * 1024);
    }
  }
  expect(ordinaryIntervalTicks(rational(1n, 100000n), 100)).toBe(1);
  expect(() => scaleFixed(Number.MAX_SAFE_INTEGER, rational(2n))).toThrow('safe');
});
