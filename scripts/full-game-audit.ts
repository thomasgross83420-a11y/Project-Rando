import { newGame, maxHealth, type GameState, type Plan } from '../src/game/model';
import { FRIENDLIES, definition } from '../src/game/catalog';
import { buy, place, validateLayout } from '../src/game/construction';
import { compile, stageInfo } from '../src/game/director';
import { FullBattle } from '../src/game/engine';
import { validateSnapshot } from '../src/game/validation';
import { priceResult, claimResult } from '../src/game/economy';
export function completeFixture(): GameState {
  const s = newGame('Full game regression', 0, 'Bastion', 'warden.bulwark');
  s.rank = 100;
  s.stages = Array.from({ length: 40 }, (_, i) => i);
  s.credits = 1000000;
  s.cores = 1000;
  s.land = ['North', 'East', 'South', 'West', 'NW', 'NE', 'SE', 'SW'];
  s.assets = s.assets.filter((a) => a.type === s.warden);
  s.assets[0]!.placement = { x: 29, y: 33, rotation: 0 };
  s.assets[0]!.tactics.anchor = { x: 30, y: 34 };
  for (const d of FRIENDLIES.filter((d) => d.category !== 'warden')) {
    const a = buy(s, d.id);
    let placed = false;
    for (let y = 12; y < 48 && !placed; y += 4)
      for (let x = 12; x < 48 && !placed; x += 4) {
        try {
          place(s, a.id, x, y);
          placed = true;
        } catch {
          /* Reserved or occupied site: try next. */
        }
      }
    if (!placed) throw Error(`Cannot place ${d.name}`);
  }
  s.assets.forEach((a, i) => {
    a.id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    if (definition(a.type).profile) {
      a.level = 100;
      a.xp = 78498;
      a.stars = 6;
      a.branch = 'A';
      a.coresPaid = 82;
      a.enhancement = 10;
    }
    a.hp = maxHealth(a);
  });
  validateSnapshot(s);
  const errors = validateLayout(s);
  if (errors.length) throw Error(errors.join(';'));
  return s;
}
export async function fullGameAudit(onRow: (row: unknown) => Promise<void>) {
  const fixture = completeFixture(),
    cases: Plan[] = [];
  for (let stage = 0; stage < 40; stage++)
    cases.push(
      await compile({
        mode: 'Campaign',
        stage,
        rank: 100,
        seed: 'full-game-audit',
        difficulty: 'Standard',
      }),
    );
  for (let trial = 0; trial < 12; trial++)
    cases.push(
      await compile({
        mode: 'Mastery',
        trial,
        rank: 100,
        seed: 'full-game-audit',
        difficulty: 'Standard',
      }),
    );
  cases.push(
    await compile({
      mode: 'Expedition',
      rank: 100,
      band: 20,
      recipe: 'Alternating fronts',
      seed: 'full-game-audit',
      difficulty: 'Standard',
    }),
  );
  cases.push(
    await compile({
      mode: 'Calibration',
      rank: 100,
      band: 20,
      seed: 'full-game-audit',
      difficulty: 'Standard',
      calibration: { type: 'enemy.carrier', count: 3, variant: 3, entrance: 0 },
    }),
  );
  cases.push(
    await compile({
      mode: 'Boss Siege',
      rank: 100,
      band: 20,
      boss: 'boss.root_below',
      seed: 'full-game-audit-boss',
      difficulty: 'Standard',
    }),
  );
  cases.push(
    await compile({
      mode: 'Long Watch',
      rank: 100,
      band: 20,
      boss: 'boss.prism_sovereign',
      seed: 'full-game-audit-watch',
      difficulty: 'Standard',
    }),
  );
  cases.push({ ...structuredClone(cases[0]!), mode: 'Archive', originMode: 'Campaign' });
  const endurance = await compile({
    mode: 'Endurance',
    rank: 100,
    band: 10,
    blocks: 6,
    seed: 'full-game-audit',
    difficulty: 'Standard',
  });
  cases.push({ ...endurance, following: [] }, ...endurance.following);
  const rows = [];
  for (let i = 0; i < cases.length; i++) {
    const plan = cases[i]!,
      s = structuredClone(fixture),
      b = await FullBattle.create(s, plan),
      started = performance.now();
    while (!b.outcome && !b.needsRecovery && b.tick < (plan.duration + 300) * 60) b.step();
    if (
      b.population > 120 ||
      b.projectiles.length > 300 ||
      !b.entities.every(
        (e) =>
          Number.isSafeInteger(e.hp) &&
          e.hp >= 0 &&
          Number.isSafeInteger(e.x) &&
          Number.isSafeInteger(e.y),
      )
    )
      throw Error('Invalid simulation state ' + plan.name);
    const recoveryPause = b.needsRecovery;
    if (recoveryPause) b.surrender();
    if (!b.outcome)
      throw Error(
        `Unresolved ${plan.name}: ${JSON.stringify(b.alive(1).map((e) => ({ type: e.d.id, x: e.x / 1024, y: e.y / 1024, hp: e.hp, path: e.path })))}`,
      );
    const result = priceResult(s, b.result(`full-game-${i}`, '1'));
    s.sequence = '1';
    claimResult(s, result);
    validateSnapshot(s);
    const wallet = s.credits;
    let duplicateRejected = false;
    try {
      claimResult(s, result);
    } catch {
      duplicateRejected = true;
    }
    if (!duplicateRejected || s.credits !== wallet) throw Error('Duplicate reward accepted');
    const row = {
      index: i,
      mode: plan.mode,
      stage: plan.stage,
      code: plan.stage === null ? null : stageInfo(plan.stage).code,
      name: plan.name,
      hash: plan.hash,
      block: plan.block,
      boss: plan.boss,
      outcome: b.outcome,
      recoveryPause,
      seconds: b.tick / 60,
      corePercent: Math.round(b.core.hp / 102400),
      simulationMs: Math.round(performance.now() - started),
      duplicateRewardRejected: true,
    };
    rows.push(row);
    await onRow(row);
  }
  return {
    method:
      'Full combat and reward regression with a legal seeded Rank100 army containing every ordinary friendly role. Not a natural economy playthrough or a difficulty-balance certification. Standard 40 campaign stages, 12 Mastery trials, late mixed Expedition, Calibration and all six Endurance block plans. Each must terminate or explicitly enter the 90-second recovery pause followed by test withdrawal, preserve integer/cap invariants and reject duplicate reward claims.',
    rows,
  };
}
