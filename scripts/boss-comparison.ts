import { type GameState, type Plan, assertGame } from '../src/game/model';
import { buy, guidedLayout } from '../src/game/construction';
import { FullBattle } from '../src/game/engine';
export async function bossComparison(start: GameState, plan: Plan) {
  const rows = [];
  const setups = [
    { name: 'Steady overlapping fire', types: Array(4).fill('friendly.sentry'), guard: false },
    {
      name: 'Rapid fire and stationary repair',
      types: ['friendly.rotary', 'friendly.sentry', 'friendly.sentry', 'friendly.repair_node'],
      guard: false,
    },
    {
      name: 'Heavy fire and repair',
      types: ['friendly.rotary', 'friendly.heavy_squad', 'friendly.repair_node'],
      guard: true,
    },
  ];
  for (const setup of setups) {
    const s = structuredClone(start),
      before = s.credits;
    for (const type of setup.types) buy(s, type);
    s.assets.forEach((a, i) => {
      a.id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    });
    guidedLayout(s, plan.spawns[0]!.entrance);
    if (setup.guard)
      for (const a of s.assets) {
        a.tactics.posture = 'Defensive';
        a.tactics.core = 'High';
      }
    assertGame(s);
    const b = await FullBattle.create(s, plan);
    while (!b.outcome && !b.needsRecovery && b.tick < (plan.duration + 180) * 60) b.step();
    const row = {
      name: setup.name,
      purchases: setup.types,
      spend: before - s.credits,
      reserve: s.credits,
      outcome: b.outcome,
      core: Math.round(b.core.hp / 102400),
      seconds: b.tick / 60,
      recovery: b.needsRecovery,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  return {
    method:
      'Alternative legal purchases from the captured Mobile checkpoint after four natural campaign victories; no injected currencies or levels. Same declared first boss, Standard. Tests positioning/support choices rather than adjusting stats.',
    rows,
  };
}
