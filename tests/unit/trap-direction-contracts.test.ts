import { it, expect } from 'vitest';
import { newGame, makeAsset, type Spawn } from '../../src/game/model';
import { compile } from '../../src/game/director';
import { FullBattle, type Entity } from '../../src/game/engine';
import { direction } from '../../src/sim/fixed';
async function fixture(type: string, rotation = 0) {
  const s = newGame('Trap test', 0, 'Bastion', 'warden.bulwark'),
    asset = makeAsset(type);
  asset.placement = { x: 24, y: 24, rotation };
  s.assets = [asset];
  const plan = await compile({
      mode: 'Campaign',
      stage: 0,
      rank: 1,
      seed: 'trap-direction',
      difficulty: 'Standard',
    }),
    battle = await FullBattle.create(s, plan);
  const internal = battle as unknown as { spawn(s: Spawn): boolean; traps(e: Entity): void };
  internal.spawn({ ...plan.spawns[0]!, type: 'enemy.bulwark' });
  battle.plan.spawns = [];
  const trap = battle.entities.find((e) => e.owned === asset.id)!,
    enemy = battle.alive(1)[0]!;
  enemy.hp = 10000000;
  enemy.stats.speed = 0;
  enemy.nextAttack = 1e9;
  enemy.nextDecision = 1e9;
  return { battle, internal, trap, enemy };
}
it('all four placed vent facings trigger only forward and burn once per activation', async () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const { battle, internal, trap, enemy } = await fixture('friendly.incendiary_vent', rotation),
      forward = direction(rotation * 16384, 1536);
    enemy.x = trap.x - forward.x;
    enemy.y = trap.y - forward.y;
    internal.traps(trap);
    expect(trap.charges).toBe(6);
    enemy.x = trap.x + forward.x;
    enemy.y = trap.y + forward.y;
    internal.traps(trap);
    expect(trap.charges).toBe(5);
    for (let i = 0; i < 20; i++) battle.step();
    const burn = enemy.statuses.find((s) => s.kind.startsWith('burn.'));
    expect(burn).toBeDefined();
    const expiry = burn!.until;
    for (let i = 0; i < 160; i++) battle.step();
    expect(enemy.statuses.filter((s) => s.kind.startsWith('burn.'))).toHaveLength(1);
    expect(enemy.statuses.find((s) => s.kind.startsWith('burn.'))!.until).toBe(expiry);
  }
});
it('a root-immune nearer enemy does not waste or block a snare charge', async () => {
  const { battle, internal, trap, enemy } = await fixture('friendly.gravity_snare');
  enemy.x = trap.x + 1024;
  enemy.y = trap.y;
  enemy.cooldowns.rootImmune = 1000;
  internal.traps(trap);
  expect(trap.charges).toBe(4);
  const second: Entity = {
    ...enemy,
    id: enemy.id + 1000,
    x: trap.x + 1536,
    memory: {},
    cooldowns: {},
    statuses: [],
  };
  battle.entities.push(second);
  internal.traps(trap);
  expect(trap.charges).toBe(3);
  expect(second.statuses.some((s) => s.kind === 'root')).toBe(true);
  expect(enemy.statuses.some((s) => s.kind === 'root')).toBe(false);
});
it('Bulwark and Mender formations advance instead of pulling each other toward the boundary', async () => {
  const s = newGame('Formation', 0, 'Bastion', 'warden.bulwark');
  s.assets = [];
  const p = await compile({
      mode: 'Campaign',
      stage: 0,
      rank: 1,
      seed: 'formation',
      difficulty: 'Standard',
    }),
    b = await FullBattle.create(s, p),
    spawn = b as unknown as { spawn(s: Spawn): boolean };
  b.plan.spawns = [];
  for (const [type, x, y] of [
    ['enemy.bulwark', 50, 50],
    ['enemy.bulwark', 49, 51],
    ['enemy.mender', 53, 53],
  ] as const) {
    spawn.spawn({ ...p.spawns[0]!, type });
    const e = b.alive(1).at(-1)!;
    e.x = x * 1024;
    e.y = y * 1024;
    e.target = b.core.id;
    e.nextDecision = 1e9;
  }
  const first = b.alive(1).map((e) => Math.hypot(e.x - b.core.x, e.y - b.core.y));
  for (let i = 0; i < 600; i++) b.step();
  for (const [i, e] of b.alive(1).entries())
    expect(Math.hypot(e.x - b.core.x, e.y - b.core.y)).toBeLessThan(first[i]! - 2048);
});
it('a noncombat cleanup stalemate pauses safely and cannot invent damage or victory', async () => {
  const s = newGame('Stalemate', 0, 'Bastion', 'warden.bulwark');
  s.assets = [];
  const p = await compile({
      mode: 'Calibration',
      rank: 100,
      band: 20,
      seed: 'stalemate',
      difficulty: 'Standard',
      calibration: { type: 'enemy.mender', count: 1, variant: 0, entrance: 0 },
    }),
    b = await FullBattle.create(s, p);
  for (let i = 0; i < 12000 && !b.needsRecovery; i++) b.step();
  expect(b.needsRecovery).toBe(true);
  expect(b.outcome).toBeNull();
  expect(b.core.hp).toBe(10240000);
  const tick = b.tick;
  b.step();
  expect(b.tick).toBe(tick);
  b.surrender();
  expect(b.outcome).toBe('Defeat');
});
