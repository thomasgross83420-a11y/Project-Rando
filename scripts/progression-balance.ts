import { Battle, type BattleEvent } from '../src/sim/battle';
import { hash } from '../src/sim/determinism';
import { tutorialArmy } from '../tests/fixtures/tutorial';
import { captureProfile, developingSlice, PROFILE_POLICY } from '../src/progression/profile';
import { ACCURACY_POLICY, grownAccuracy } from '../src/progression/accuracy';
import { quoteRepair, quoteRestore } from '../src/economy/recovery';
import { foundation } from '../src/data/foundation';
import { quoteEnhancement } from '../src/progression/purchases';
const required = <T>(value: T | undefined | null): T => {
  if (value == null) throw new Error('Incomplete study evidence');
  return value;
};
const levels = [1, 10, 25, 50, 75, 100];
const seeds = Array.from({ length: 4 }, (_, i) =>
  i === 0 ? 'rb-tutorial-v1' : `progression-paired-${i}`,
);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? required(sorted[middle])
    : (required(sorted[middle - 1]) + required(sorted[middle])) / 2;
};
export const summarizeNumbers = (values: number[]) => ({
  min: Math.min(...values),
  median: median(values),
  max: Math.max(...values),
});
export async function measureProgressionBalance() {
  const results: Array<{
    case: string;
    outcome: string;
    combatSeconds: number;
    quotedBodyRecovery: number;
    [key: string]: unknown;
  }> = [];
  const cases = levels
    .flatMap((level) => [
      {
        id: `guided-L${level}-E0-band${Math.ceil(level / 5)}`,
        level,
        enhancement: 0,
        band: Math.ceil(level / 5),
        network: 'guided',
        accuracyGrowth: true,
      },
      {
        id: `guided-L${level}-E${Math.floor(level / 10)}-band${Math.ceil(level / 5)}`,
        level,
        enhancement: Math.floor(level / 10),
        band: Math.ceil(level / 5),
        network: 'guided',
        accuracyGrowth: true,
      },
    ])
    .filter((c, i, all) => all.findIndex((a) => a.id === c.id) === i);
  cases.push(
    {
      id: 'guided-L100-E10-band1',
      level: 100,
      enhancement: 10,
      band: 1,
      network: 'guided',
      accuracyGrowth: true,
    },
    {
      id: 'guided-L100-E10-band20-baseline-accuracy',
      level: 100,
      enhancement: 10,
      band: 20,
      network: 'guided',
      accuracyGrowth: false,
    },
    {
      id: 'mobile-L1-E0-band20',
      level: 1,
      enhancement: 0,
      band: 20,
      network: 'mobile',
      accuracyGrowth: true,
    },
    {
      id: 'mobile-L100-E0-band20',
      level: 100,
      enhancement: 0,
      band: 20,
      network: 'mobile',
      accuracyGrowth: true,
    },
    {
      id: 'mobile-L100-E10-band20',
      level: 100,
      enhancement: 10,
      band: 20,
      network: 'mobile',
      accuracyGrowth: true,
    },
    {
      id: 'mobile-L100-E10-band20-baseline-accuracy',
      level: 100,
      enhancement: 10,
      band: 20,
      network: 'mobile',
      accuracyGrowth: false,
    },
  );
  for (const c of cases)
    for (const seed of seeds) {
      const army = tutorialArmy().filter(
        (a) =>
          c.network === 'guided' || ['friendly.rifle_squad', 'warden.bulwark'].includes(a.type),
      );
      const assets = army
        .filter((a) => (developingSlice as readonly string[]).includes(a.type))
        .map((a) => ({ uuid: a.uuid, level: c.level, enhancement: c.enhancement }));
      const b = await Battle.createStudy(army, {
        schema: 1,
        seed,
        band: c.band,
        accuracyGrowth: c.accuracyGrowth,
        assets,
      });
      const damage: Record<string, number> = {},
        repair: Record<string, number> = {};
      let last: BattleEvent | undefined;
      while ((b.state === 'Siege' || b.state === 'Cleanup') && b.tick < 21600) {
        b.step();
        if (b.events.at(-1) === last) continue;
        const i = last ? b.events.indexOf(last) : -1;
        if (last && i < 0) throw new Error('Event collector overflow');
        for (const e of b.events.slice(i + 1)) {
          const source = b.get(e.source),
            target = b.get(e.target);
          if (e.kind === 'impact' && source && target && source.team !== target.team)
            damage[source.type] = (damage[source.type] ?? 0) + e.value / 1024;
          if (e.kind === 'repair' && source)
            repair[source.type] = (repair[source.type] ?? 0) + e.value / 1024;
        }
        last = b.events.at(-1);
      }
      const observed = b.observedShots,
        roles = [...new Set(observed.map((s) => required(b.get(s.source)).type))].sort();
      const shots = roles.map((role) => {
        const samples = observed.filter((s) => b.get(s.source)?.type === role);
        return {
          role,
          released: samples.length,
          accuracyPass: samples.filter((s) => s.accuracyPassed).length,
          intended: samples.filter((s) => s.resolution === 'intended').length,
          otherHostile: samples.filter((s) => s.resolution === 'other-hostile').length,
          friendlySolid: samples.filter((s) => s.resolution === 'friendly-solid').length,
          expired: samples.filter((s) => s.resolution === 'expired').length,
          inFlight: samples.filter((s) => s.resolution === 'in-flight').length,
          passedButDidNotLandIntended: samples.filter(
            (s) => s.accuracyPassed && s.resolution !== 'intended' && s.resolution !== 'in-flight',
          ).length,
          failedButLandedIntended: samples.filter(
            (s) => !s.accuracyPassed && s.resolution === 'intended',
          ).length,
        };
      });
      let recovery = 0;
      for (const a of army) {
        const index = [...army]
            .sort((a, b) => (a.uuid < b.uuid ? -1 : 1))
            .findIndex((v) => v.uuid === a.uuid),
          e = required(b.get(index + 2));
        const base = foundation[a.type as keyof typeof foundation];
        if (!base) throw new Error('Missing investment base');
        const enhancementPaid = assets.some((p) => p.uuid === a.uuid)
          ? Array.from(
              { length: c.enhancement },
              (_, i) =>
                quoteEnhancement(a.type === 'warden.bulwark' ? 500 : base.cost, c.level, i).credits,
            ).reduce((a, b) => a + b, 0)
          : 0;
        const investment = {
          body: e.hp,
          maximum: e.maxHP,
          baseCost: base.cost,
          enhancementPaid,
          promotionCoresPaid: 0,
          warden: a.type === 'warden.bulwark',
          core: false,
          refundLocked: false,
          emergencyCreated: false,
        };
        // Stock is separate. A consumed one-charge Mine is not a body wreck cost.
        if (a.type === 'friendly.proximity_mine') continue;
        recovery +=
          e.hp > 0
            ? quoteRepair(investment, e.maxHP - e.hp).credits
            : quoteRestore(investment).credits;
      }
      recovery += quoteRepair(
        {
          body: b.core.hp,
          maximum: b.core.maxHP,
          baseCost: 0,
          enhancementPaid: 0,
          promotionCoresPaid: 0,
          warden: false,
          core: true,
          refundLocked: false,
          emergencyCreated: false,
        },
        b.core.maxHP - b.core.hp,
      ).credits;
      const row = {
        case: c.id,
        seed,
        level: c.level,
        enhancement: c.enhancement,
        band: c.band,
        accuracyGrowth: c.accuracyGrowth,
        outcome: b.state,
        combatSeconds: b.tick / 60,
        kills: b.kills,
        coreRemaining: b.core.hp / 1024,
        damageByRole: damage,
        repairByRole: repair,
        shots,
        quotedBodyRecovery: recovery,
        friendlyEnd: b.entities
          .filter((e) => e.team === 'friendly')
          .map((e) => ({ id: e.id, type: e.type, body: e.hp / 1024, max: e.maxHP / 1024 })),
        hash: await hash(b.snapshot()),
      };
      results.push(row);
      console.log(
        JSON.stringify({
          case: row.case,
          seed: row.seed,
          outcome: row.outcome,
          seconds: row.combatSeconds,
          bodyRecovery: recovery,
        }),
      );
    }
  return {
    date: '2026-10-08',
    build: '0.2.5-progression-balance',
    profilePolicy: PROFILE_POLICY,
    accuracyPolicy: ACCURACY_POLICY,
    scope:
      'Current-slice deterministic studies; authored 24-body / 30TP schedule, not generated campaign or late-game budgets',
    method:
      'Paired four accuracy seeds across identical layouts and schedules. Actual capped body damage and physical projectile contacts. Band affects declared health/damage/armor only. Full-health baseline; enhancements assumed purchased; no stars/perks. Body recovery quotes, not committed expenses or normal-run reward ratios.',
    aggregation:
      'Median is the arithmetic mean of the two central observations for even sample sizes.',
    limits: [
      'Four seeds are a sensitivity sample, not statistical balance certification or player fun validation.',
      'No real rank-to-level pacing, full threats, bosses, ranged enemies, difficulty budgets or net-income acceptance claim.',
      'Quotes exclude mine rearm and do not establish the 10-35% recovery/gross target.',
      'No live campaign stat changes or retroactive save migration.',
    ],
    cases: cases.map((c) => {
      const r = results.filter((r) => r.case === c.id);
      return {
        ...c,
        runs: r.length,
        outcomes: r.map((r) => r.outcome),
        combatSeconds: summarizeNumbers(r.map((r) => r.combatSeconds)),
        bodyRecovery: summarizeNumbers(r.map((r) => r.quotedBodyRecovery)),
      };
    }),
    accuracyReferences: [80, 85, 90, 95, 100].map((base) => ({
      base,
      levels: levels.map((level) => {
        const p = grownAccuracy(base, level);
        return {
          level,
          numerator: String(p.n),
          denominator: String(p.d),
          percent: (Number(p.n) * 100) / Number(p.d),
        };
      }),
    })),
    statReferences: levels.flatMap((level) =>
      [0, Math.floor(level / 10)]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((enhancement) => {
          const p = captureProfile('friendly.sentry', level, enhancement),
            w = required(p.definition.weapon),
            a = required(p.accuracy);
          return {
            level,
            enhancement,
            body: p.definition.hp / 1024,
            damage: w.damage / 1024,
            intervalTicks: w.interval,
            range: w.range / 1024,
            accuracyPercent: (100 * a.numerator) / a.denominator,
            rollWeightedDPS:
              ((((w.damage / 1024) * 60) / w.interval) * a.numerator) / a.denominator,
          };
        }),
    ),
    results,
  };
}
