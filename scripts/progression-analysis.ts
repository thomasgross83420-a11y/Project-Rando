import thresholds from '../src/data/progression.json';
import {
  growthFactors,
  scaleFixed,
  grownRange,
  ordinaryIntervalTicks,
} from '../src/progression/growth';
import { allocateAssetXP, levelUpBody, ASSET_XP_CAP } from '../src/progression/allocation';
import {
  quoteRepair,
  quoteRestore,
  quoteSale,
  quoteRearm,
  type BodyInvestment,
} from '../src/economy/recovery';
import { rational } from '../src/economy/policy';
const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export function progressionEvidence() {
  const growth = Array.from({ length: 100 }, (_, i) => {
    const level = i + 1,
      e = Math.floor(level / 10),
      f = growthFactors(level, e);
    const maximum = scaleFixed(1200 * 1024, f.health);
    return {
      level,
      enhancement: e,
      maximumIntegrity: maximum / 1024,
      woundedIntegrity: levelUpBody(1100 * 1024, 1200 * 1024, maximum) / 1024,
      damage: scaleFixed(40 * 1024, f.output) / 1024,
      rangeGU: grownRange(8 * 1024, level, e) / 1024,
      intervalTicks: ordinaryIntervalTicks(rational(4n, 5n), level),
    };
  });
  let conserved = 0;
  for (let seed = 1; seed <= 512; seed++) {
    const xp = Array.from({ length: 1 + (seed % 30) }, (_, i) => ({
      id: id(i + 1),
      xp: 0,
      level: 1,
      developing: true,
      blocks: 1 + ((seed + i) % 6),
      contribution: BigInt((seed * 31 + i * 17) % 1000),
    }));
    const pool = BigInt(seed) * 1000000000000001n;
    const a = allocateAssetXP(pool, 1 + (seed % 100), xp),
      b = allocateAssetXP(pool, 1 + (seed % 100), [...xp].reverse());
    if (
      a.granted + a.unused !== pool ||
      a.allocations.some((p, i) => p.allocated !== b.allocations[i]?.allocated)
    )
      throw new Error('Progression conservation/order failure');
    conserved++;
  }
  const a: BodyInvestment = {
    body: 600 * 1024,
    maximum: 1200 * 1024,
    baseCost: 250,
    enhancementPaid: 0,
    promotionCoresPaid: 0,
    warden: false,
    core: false,
    refundLocked: false,
    emergencyCreated: false,
  };
  return {
    build: '0.2.4-campaign-result-contracts',
    scope:
      'Pure arithmetic and synthetic protocol fixtures; no live campaign rewards or stat changes',
    thresholdPolicy: thresholds.policy,
    rankCostCount: thresholds.rankNext.length,
    assetThresholdCount: thresholds.assetCumulative.length,
    assetXPCap: ASSET_XP_CAP,
    conservedPermutationCases: conserved,
    accuracyGrowth:
      'Unspecified by blueprint; linear +5 percentage-point proposal awaits user input',
    growth,
    recoveryReferences: {
      sentryHalfBodyRepair: quoteRepair(a, 600 * 1024),
      sentryMasteredRestore: quoteRestore({ ...a, body: 0, enhancementPaid: 2690 }),
      sentryMasteredHalfBodySale: quoteSale({
        ...a,
        enhancementPaid: 2690,
        promotionCoresPaid: 82,
      }),
      mineRearm: quoteRearm(75, 1, 0, 1),
    },
  };
}
