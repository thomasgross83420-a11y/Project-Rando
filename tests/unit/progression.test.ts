import { expect, it } from 'vitest';
import thresholds from '../../src/data/progression.json';
import {
  allocateAssetXP,
  applyRankXP,
  ASSET_XP_CAP,
  assetLevel,
  levelUpBody,
  type Participant,
} from '../../src/progression/allocation';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const participant = (n: number, xp = 0, contribution = 0n, blocks = 1): Participant => ({
  id: id(n),
  xp,
  level: assetLevel(xp),
  developing: true,
  blocks,
  contribution,
});
it('pins every threshold and crosses exact rank/asset boundaries without runtime powers', () => {
  expect(thresholds.rankNext).toHaveLength(99);
  expect(thresholds.assetCumulative).toHaveLength(100);
  for (const [level, xp] of [
    [1, 0],
    [2, 40],
    [10, 1502],
    [25, 7575],
    [45, 20595],
    [70, 43267],
    [100, 78498],
  ] as const) {
    expect(assetLevel(xp)).toBe(level);
    if (xp) expect(assetLevel(xp - 1)).toBe(level - 1);
  }
  expect(applyRankXP(1, 99, 1n)).toMatchObject({ rank: 2, progress: 0, crossed: [2] });
  const total = thresholds.rankNext.reduce((a, b) => a + BigInt(b), 0n);
  expect(applyRankXP(1, 0, total + 7n)).toMatchObject({ rank: 100, progress: 0, lifetime: 7n });
  expect(applyRankXP(1, 0, total).crossed).toHaveLength(99);
  expect(() => applyRankXP(1, 100, 0n)).toThrow();
  expect(() => applyRankXP(100, 1, 0n)).toThrow();
});
it('allocates exact combined 70/30 shares, catch-up and block participation with deterministic ID ties', () => {
  const a = participant(1, 0, 3n),
    b = participant(2, 7575, 1n);
  expect(allocateAssetXP(100n, 26, [a, b]).allocations.map((p) => p.allocated)).toEqual([74n, 26n]);
  const tie = allocateAssetXP(2n, 1, [participant(3), participant(2), participant(1)]);
  expect(tie.allocations.map((p) => p.allocated)).toEqual([1n, 1n, 0n]);
  const blocks = allocateAssetXP(100n, 1, [participant(1, 0, 0n, 3), participant(2)]);
  expect(blocks.allocations.map((p) => p.allocated)).toEqual([75n, 25n]);
  const contribution = allocateAssetXP(100n, 1, [participant(1, 0, 100n), participant(2)]);
  expect(contribution.allocations.map((p) => p.allocated)).toEqual([65n, 35n]);
});
it('excludes stored/fixed/already-capped recipients, retains incapacitated participation and reports new-cap excess', () => {
  const input = [
    participant(1, ASSET_XP_CAP),
    { ...participant(2), developing: false },
    participant(3, 0, 1000n, 0),
    participant(4, ASSET_XP_CAP - 1),
  ];
  const r = allocateAssetXP(1000n, 100, input);
  expect(r.allocations).toHaveLength(1);
  expect(r.allocations[0]).toMatchObject({
    id: id(4),
    allocated: 1000n,
    granted: 1n,
    unused: 999n,
    xp: ASSET_XP_CAP,
    level: 100,
  });
  expect(r.granted + r.unused).toBe(1000n);
  expect(allocateAssetXP(100n, 100, input.slice(0, 3))).toMatchObject({
    granted: 0n,
    unused: 100n,
  });
  expect(levelUpBody(0, 100, 200)).toBe(0);
  expect(levelUpBody(10, 100, 200)).toBe(110);
});
it('conserves wide XP across bounded deterministic permutations without changing tied recipients', () => {
  for (let seed = 1; seed <= 512; seed++) {
    const input = Array.from({ length: 1 + (seed % 30) }, (_, i) =>
      participant(
        i + 1,
        (seed * (i + 7) * 13) % ASSET_XP_CAP,
        BigInt((seed * 31 + i * 17) % 1000),
        1 + ((seed + i) % 6),
      ),
    );
    const pool = BigInt(seed) * 1000000000000001n;
    const a = allocateAssetXP(pool, 1 + (seed % 100), input),
      b = allocateAssetXP(pool, 1 + (seed % 100), [...input].reverse());
    expect(a).toEqual(b);
    expect(a.granted + a.unused).toBe(pool);
    expect(a.allocations.reduce((sum, p) => sum + p.allocated, 0n)).toBe(pool);
  }
  expect(() => allocateAssetXP(1n, 1, [participant(1), participant(1)])).toThrow('duplicate');
  expect(() => allocateAssetXP(1n, 1, [{ ...participant(1), level: 2 }])).toThrow('mismatch');
});
it('saturates nonspendable lifetime counters while rank and spendable values stay separate', () => {
  const cap = (1n << 128n) - 1n;
  expect(applyRankXP(100, 0, 10n, cap - 1n)).toMatchObject({
    lifetime: cap,
    saturated: true,
    rank: 100,
    progress: 0,
  });
  expect(applyRankXP(100, 0, 0n, cap, true).saturated).toBe(true);
});
