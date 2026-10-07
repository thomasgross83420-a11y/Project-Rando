import {
  calculateReward,
  ECONOMY_POLICY,
  multiply,
  originWeight,
  pressureProfile,
  rational,
  resamplePressure,
  type RewardBucket,
  type RewardContext,
} from '../src/economy/policy';
import { Battle } from '../src/sim/battle';
import { hash } from '../src/sim/determinism';
import { tutorialArmy } from '../tests/fixtures/tutorial';
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
export async function analyzeEconomy() {
  let cases = 0,
    monotonicChecks = 0;
  const difficulties = ['Cadet', 'Standard', 'Veteran', 'Master', 'Cataclysm'] as const;
  for (let band = 1; band <= 20; band++)
    for (const difficulty of difficulties)
      for (const duration of [90, 120, 180, 240, 300, 420] as const)
        for (const order of ['original', 'reverse', 'rotate'] as const)
          for (let challengeTier = 0; challengeTier <= 8; challengeTier++)
            for (const penalized of [false, true]) {
              const pressures = resamplePressure(Math.ceil(duration / 20), order);
              const buckets: RewardBucket[] = pressures.map((pressure, i) => ({
                block: 1,
                segment: i + 1,
                duration,
                pressure,
                plannedQTP: 120,
                destroyedQTP: 120,
              }));
              const context = {
                ...standard,
                band,
                difficulty,
                challengeTier,
                runStartRank: penalized ? 100 : Math.min(100, 5 * band),
              };
              const victory = calculateReward(context, buckets, 'Victory'),
                defeat = calculateReward(context, buckets, 'Defeat');
              if (victory.credits < defeat.credits || defeat.promotionCores !== 0n)
                throw new Error('Completion/defeat conservation');
              const empty = calculateReward(
                context,
                buckets.map((b) => ({ ...b, destroyedQTP: 0 })),
                'Defeat',
              );
              if (empty.credits || empty.bastionXP || empty.assetXPPool || empty.promotionCores)
                throw new Error('Zero-kill reward leak');
              cases += 3;
              if (challengeTier < 8) {
                const next = calculateReward(
                  { ...context, challengeTier: challengeTier + 1 },
                  buckets,
                  'Defeat',
                );
                if (
                  next.killCredits.n * defeat.killCredits.d <
                  defeat.killCredits.n * next.killCredits.d
                )
                  throw new Error('Credit tier monotonicity');
                if (next.bastionXP !== defeat.bastionXP || next.assetXPPool !== defeat.assetXPPool)
                  throw new Error('Credit-only tier leaked into XP');
                monotonicChecks++;
              }
            }
  const golden = [];
  for (const [rank, band] of [
    [1, 1],
    [10, 2],
    [25, 5],
    [50, 10],
    [75, 15],
    [100, 20],
  ]) {
    if (!rank || !band) throw new Error('Missing golden case');
    const buckets: RewardBucket[] = pressureProfile.map((p, i) => {
      const budget = Math.floor(((20 + 4 * (band - 1)) * (5500 + 90 * p)) / 10000);
      return {
        block: 1,
        segment: i + 1,
        duration: 300,
        pressure: rational(BigInt(p), 100n),
        plannedQTP: budget * 4,
        destroyedQTP: budget * 4,
      };
    });
    const r = calculateReward({ ...standard, band, runStartRank: rank }, buckets, 'Victory');
    golden.push({
      rank,
      band,
      assumedBudgetTP: r.unweightedTP,
      credits: r.credits,
      xp: r.bastionXP,
      assetPool: r.assetXPPool,
      cores: r.promotionCores,
    });
  }
  const b = await Battle.create(tutorialArmy()),
    seen = new Set<number>(),
    pressures = resamplePressure(5);
  const buckets: RewardBucket[] = pressures.map((pressure, i) => ({
    block: 1,
    segment: i + 1,
    duration: 90,
    pressure,
    plannedQTP: 0,
    destroyedQTP: 0,
  }));
  const origins = new Map<number, { index: number; qTP: number }>();
  for (const packet of b.plan.packets) {
    const origin = Math.floor(packet.tick / 1200),
      bucket = buckets[origin];
    if (!bucket) throw new Error('Packet origin outside plan');
    bucket.plannedQTP += packet.tp * 4;
    origins.set(1000 + packet.id, { index: origin, qTP: packet.tp * 4 });
  }
  while ((b.state === 'Siege' || b.state === 'Cleanup') && b.tick < 21600) {
    b.step();
    for (const e of b.entities)
      if (e.team === 'hostile' && e.hp === 0 && !seen.has(e.id)) {
        const origin = origins.get(e.id);
        if (origin === undefined) throw new Error('Unknown allocation; never guess reward origin');
        const bucket = buckets[origin.index];
        if (!bucket) throw new Error('Missing origin');
        bucket.destroyedQTP += origin.qTP;
        seen.add(e.id);
      }
  }
  if (buckets.reduce((n, bucket) => n + bucket.destroyedQTP, 0) !== b.destroyedTP * 4)
    throw new Error('Destruction allocation conservation');
  if (b.state !== 'Victory') throw new Error('Actual tutorial did not clear');
  const comparison = calculateReward(standard, buckets, 'Victory');
  const first = buckets[0];
  if (!first) throw new Error('Missing prefix');
  for (let block = 1; block <= 6; block++) {
    const local = { ...first, block, duration: 300 as const };
    if (
      originWeight(local).n * originWeight(first).d <
      originWeight(first).n * originWeight(local).d
    )
      throw new Error('Endurance origin progression');
    // Same allocation in the first block remains identical regardless of a
    // planned six-block session; the kernel has no promised-duration multiplier.
    if (
      block === 1 &&
      calculateReward(standard, [local], 'Defeat').credits !==
        calculateReward(standard, [first], 'Defeat').credits
    )
      throw new Error('Unplayed-duration windfall');
  }
  const example = multiply(
    rational(4n),
    originWeight({
      block: 3,
      segment: 15,
      duration: 300,
      pressure: rational(55n, 100n),
      plannedQTP: 4,
      destroyedQTP: 4,
    }),
  );
  return {
    date: '2026-10-07',
    policy: ECONOMY_POLICY,
    arithmeticCases: cases,
    monotonicChecks,
    golden,
    actualTutorial: {
      outcome: b.state,
      ticks: b.tick,
      hash: await hash(b.snapshot()),
      kills: b.kills,
      buckets,
      hypotheticalOrdinaryReward: comparison,
      paidPracticeReward: { credits: 0, xp: 0, cores: 0 },
    },
    band20Block3PerTP: multiply(example, rational(59n, 40n)),
    limits: [
      'Synthetic arithmetic cases are not generated-plan victories or payout receipts',
      'Actual tutorial destruction origins are measured; comparison does not pay practice',
      'Full roster, persistent contributions/injuries/repair, 100-seed balance and six-block state receipts remain open',
    ],
    resampling:
      'Exact rational endpoint-preserving linear interpolation; pinned implementation choice, not measured balance',
  };
}
