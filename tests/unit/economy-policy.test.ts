import { describe, expect, it } from 'vitest';
import {
  calculateReward,
  ECONOMY_POLICY,
  halfUp,
  noAdditions,
  originWeight,
  pressureProfile,
  resamplePressure,
  rational,
  walletCredit,
  type RewardContext,
  type RewardBucket,
} from '../../src/economy/policy';
const standard: RewardContext = {
  policy: ECONOMY_POLICY,
  band: 1,
  runStartRank: 1,
  difficulty: 'Standard',
  modifiers: [],
  mastery: false,
  challengeTier: 0,
  firstCampaignAttempt: false,
};
function bucket(segment = 1): RewardBucket {
  return {
    block: 1,
    segment,
    duration: 300,
    pressure: rational(35n, 100n),
    plannedQTP: 4,
    destroyedQTP: 4,
  };
}
describe('pinned duration/wave reward arithmetic, not paid campaign receipts', () => {
  it('matches all six authoritative blueprint budget examples with one final floor', () => {
    for (const [rank, band, tp, credits, xp, pool, cores] of [
      [1, 1, 316, 1392, 1013, 1344, 1],
      [10, 2, 379, 1689, 1460, 1995, 1],
      [25, 5, 574, 2673, 3325, 4752, 1],
      [50, 10, 895, 4534, 8078, 11895, 2],
      [75, 15, 1218, 6700, 14930, 22284, 3],
      [100, 20, 1540, 9158, 23856, 35880, 4],
    ]) {
      if (!rank || !band || !tp || !credits || !xp || !pool || !cores)
        throw new Error('Golden row incomplete');
      const buckets = pressureProfile.map((p, i) => {
        const budget = (((20 + 4 * (band - 1)) * (5500 + 90 * p)) / 10000) | 0;
        return {
          ...bucket(i + 1),
          pressure: rational(BigInt(p), 100n),
          plannedQTP: budget * 4,
          destroyedQTP: budget * 4,
        };
      });
      const r = calculateReward({ ...standard, band, runStartRank: rank }, buckets, 'Victory');
      expect(r.unweightedTP).toEqual(rational(BigInt(tp)));
      expect(r.credits).toBe(BigInt(credits));
      expect(r.bastionXP).toBe(BigInt(xp));
      expect(r.assetXPPool).toBe(BigInt(pool));
      expect(r.promotionCores).toBe(BigInt(cores));
    }
  });
  it('holds earlier origins fixed, caps duration pressure, and cannot pay unplayed blocks or duplicate allocations', () => {
    const first = bucket(),
      before = calculateReward(standard, [first], 'Defeat');
    expect(before.killCredits).toEqual(rational(20907n, 6250n));
    expect(calculateReward(standard, [{ ...first, duration: 420 }], 'Defeat').credits).toBe(
      before.credits,
    );
    expect(() => calculateReward(standard, [first, { ...first }], 'Victory')).toThrow('Duplicate');
    expect(() => calculateReward(standard, [first, { ...first, block: 2 }], 'Victory')).toThrow(
      'separately',
    );
    expect(() => calculateReward(standard, [{ ...first, destroyedQTP: 8 }], 'Defeat')).toThrow();
    expect(originWeight({ ...first, block: 6, segment: 15, pressure: rational(1n) })).toEqual(
      rational(209n, 125n),
    );
  });
  it('uses unweighted TP for XP/Cores and applies defeat/zero-kill and first-claim additions in their specified order', () => {
    const empty = calculateReward(standard, [{ ...bucket(), destroyedQTP: 0 }], 'Defeat');
    expect([empty.credits, empty.bastionXP, empty.assetXPPool, empty.promotionCores]).toEqual([
      0n,
      0n,
      0n,
      0n,
    ]);
    const a = calculateReward(standard, [bucket()], 'Victory'),
      b = calculateReward(
        { ...standard, challengeTier: 8 },
        [{ ...bucket(15), pressure: rational(1n) }],
        'Victory',
      );
    expect(b.credits).toBeGreaterThan(a.credits);
    expect(b.bastionXP).toBe(a.bastionXP);
    expect(b.assetXPPool).toBe(a.assetXPPool);
    expect(b.promotionCores).toBe(a.promotionCores);
    const objective = calculateReward(
      standard,
      [{ ...bucket(), plannedQTP: 120, destroyedQTP: 120 }],
      'Victory',
      { ...noAdditions, objectives: 2, firstClearXP: 50 },
    );
    expect(objective.bastionXP).toBe(236n);
    expect(halfUp(rational(5n, 2n))).toBe(3n);
    const failed = calculateReward(standard, [bucket()], 'Defeat', {
      ...noAdditions,
      objectives: 2,
      firstClearXP: 50,
      discoveryXP: 20,
      fixedCredits: 2500,
      fixedCores: 4,
      bossBonus: 2,
    });
    expect(failed.credits).toBe(3n);
    expect(failed.bastionXP).toBe(23n);
    expect(failed.promotionCores).toBe(0n);
  });
  it('retains the exact product of different modifiers rather than rounding 1.265 to hundredths', () => {
    const context = {
      ...standard,
      modifiers: ['modifier.crossfire', 'modifier.elite_patrol'] as const,
    };
    const r = calculateReward(context, [bucket()], 'Victory');
    expect(r.factors.modifier).toEqual(rational(253n, 200n));
    expect(r.promotionCores).toBe(1n);
    expect(() =>
      calculateReward(
        { ...context, modifiers: ['modifier.elite_patrol', 'modifier.elite_patrol'] },
        [bucket()],
        'Victory',
      ),
    ).toThrow('distinct');
  });
  it('resamples the authored curve without losing fractional pressure or its endpoints', () => {
    expect(resamplePressure(5)).toEqual([
      rational(35n, 100n),
      rational(475n, 1000n),
      rational(80n, 100n),
      rational(90n, 100n),
      rational(55n, 100n),
    ]);
    expect(resamplePressure(15)).toEqual(pressureProfile.map((p) => rational(BigInt(p), 100n)));
  });
  it('captures repeat q, honors first-campaign attempts on defeat, and clips only actual wallet headroom', () => {
    const late = { ...standard, runStartRank: 100 };
    expect(calculateReward(late, [bucket()], 'Defeat').factors.repeat).toEqual(rational(3n, 20n));
    expect(
      calculateReward({ ...late, firstCampaignAttempt: true }, [bucket()], 'Defeat').factors.repeat,
    ).toEqual(rational(1n));
    const overflow = walletCredit(Number.MAX_SAFE_INTEGER - 2, 123456789012345678901n);
    expect(overflow.balance).toBe(Number.MAX_SAFE_INTEGER);
    expect(overflow.credited).toBe(2n);
    expect(overflow.uncredited).toBe(123456789012345678899n);
  });
});
