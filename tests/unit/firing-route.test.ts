import { describe, expect, it } from 'vitest';
import { Battle } from '../../src/sim/battle';
import { nearest, sweep } from '../../src/sim/collision';
import { hash } from '../../src/sim/determinism';
import { distance, U } from '../../src/sim/fixed';
import { tutorialPlan } from '../../src/sim/tutorial';
import { tutorialArmy } from '../fixtures/tutorial';

describe('obstructed firing routes and versioned replay', () => {
  it('Bulwark routes around the Core to engage its detected attackers instead of stopping at blocked range', async () => {
    const b = await Battle.create(tutorialArmy().filter((a) => a.type === 'warden.bulwark'));
    for (let i = 0; i < 2400; i++) b.step();
    const w = b.entities.find((e) => e.type === 'warden.bulwark');
    expect(w).toBeDefined();
    expect(w?.lastAction).toBeGreaterThan(0);
    expect(b.events.some((e) => e.kind === 'shot' && e.source === w?.id)).toBe(true);
    expect(b.kills).toBeGreaterThan(0);
    expect(b.core.hp).toBeGreaterThan(0);
  }, 30000);
  it('retained v1 checkpoints replay the original behavior/hash without silently adopting v2 AI', async () => {
    const plan = tutorialPlan();
    plan.simulation = 'rb-sim-v1';
    const legacyArmy = tutorialArmy().map((a) =>
      a.type === 'friendly.proximity_mine' ? { ...a, x: 22, y: 30 } : a,
    );
    const b = await Battle.create(legacyArmy, plan);
    while (b.state === 'Siege' || b.state === 'Cleanup') b.step();
    expect(b.tick).toBe(6150);
    expect(b.core.hp).toBe(10000 * U);
    expect(await hash(b.snapshot())).toBe(
      '8961c7817d3d73989a00c3e377387e6dde1ebeee16d219d5c397afc2be7839c7',
    );
  }, 30000);
  it('repositions when a zero-width sight ray clears a barrier but a real kinetic projectile clips its corner', async () => {
    const b = await Battle.create(
      tutorialArmy().filter((a) =>
        ['friendly.rifle_squad', 'friendly.standard_barricade'].includes(a.type),
      ),
    );
    for (let i = 0; i < 1801; i++) b.step();
    const rifle = b.entities.find((e) => e.type === 'friendly.rifle_squad'),
      target = b.entities.find((e) => e.type === 'enemy.raider' && e.hp > 0),
      barrier = b.entities.find((e) => e.type === 'friendly.standard_barricade');
    if (!rifle || !target || !barrier) throw new Error('Corner fixture missing');
    for (const e of b.entities) if (e.team === 'hostile' && e.id !== target.id) e.hp = 0;
    b.packet = 24;
    rifle.x = 23273;
    rifle.y = 29831;
    target.x = 21913;
    target.y = 26093;
    rifle.anchor = { x: rifle.x, y: rifle.y };
    rifle.hp = rifle.maxHP;
    rifle.goal = null;
    rifle.target = target.id;
    const start = { x: rifle.x, y: rifle.y },
      action = rifle.lastAction;
    expect(sweep(rifle, nearest(rifle, target), barrier, 0)).toBeNull();
    expect(sweep(rifle, nearest(rifle, target), barrier, 51)).not.toBeNull();
    for (let i = 0; i < 600 && rifle.lastAction === action; i++) b.step();
    expect(rifle.lastAction).toBeGreaterThan(action);
    expect(distance(rifle, start)).toBeGreaterThan(0);
  }, 30000);
});
