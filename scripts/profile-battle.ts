import { hash } from '../src/sim/determinism';
import { newGame, maxHealth } from '../src/game/model';
import { definition } from '../src/game/catalog';
import { guidedLayout } from '../src/game/construction';
import { compile } from '../src/game/director';
import { FullBattle } from '../src/game/engine';
export async function profileBattle() {
  const s = newGame('Profile', 0, 'Bastion', 'warden.bulwark');
  s.rank = 100;
  for (const a of s.assets)
    if (definition(a.type).profile) {
      a.level = 100;
      a.xp = 78498;
      a.stars = 6;
      a.branch = 'A';
      a.coresPaid = 82;
      a.hp = maxHealth(a);
    }
  s.assets.forEach((a, i) => {
    a.id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  });
  guidedLayout(s);
  const p = await compile({
      mode: 'Calibration',
      rank: 100,
      band: 20,
      seed: 'performance-profile',
      difficulty: 'Standard',
      calibration: { type: 'enemy.carrier', count: 24, variant: 3, entrance: 0 },
    }),
    b = await FullBattle.create(s, p),
    start = performance.now();
  let maximum = 0;
  for (let i = 0; i < 12000 && !b.outcome && !b.needsRecovery; i++) {
    const t = performance.now();
    b.step();
    maximum = Math.max(maximum, performance.now() - t);
  }
  return {
    fingerprint: await hash({
      tick: b.tick,
      core: b.core.hp,
      entities: b.entities.map((e) => ({
        id: e.id,
        type: e.d.id,
        hp: e.hp,
        x: e.x,
        y: e.y,
        shield: e.shield,
        target: e.target,
        charges: e.charges,
      })),
      projectiles: b.projectiles,
    }),
    needsRecovery: b.needsRecovery,
    seconds: b.tick / 60,
    ms: performance.now() - start,
    maxTick: maximum,
    outcome: b.outcome,
    entities: b.entities.length,
  };
}
