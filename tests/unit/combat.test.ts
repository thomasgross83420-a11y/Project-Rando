import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle';
import { tutorialPlan } from '../../src/sim/tutorial';
import { hash } from '../../src/sim/determinism';
import { bodyDamage, sweep } from '../../src/sim/collision';
import { bearing, direction, distance, U } from '../../src/sim/fixed';
import { tutorialArmy as army } from '../fixtures/tutorial';
describe('Gate2 deterministic combat', () => {
  it('compiles exactly 30TP / 24 scheduled bodies and no unbounded obligations', () => {
    const p = tutorialPlan();
    expect(p.packets.reduce((n, p) => n + p.tp, 0)).toBe(30);
    expect(p.packets.filter((p) => p.type === 'enemy.runner')).toHaveLength(18);
    expect(p.packets.at(-1)?.tick).toBe(5100);
  });
  it('rounds armor once, catches swept circles and rectangular corners without tunneling', () => {
    expect(bodyDamage(40 * U, 0)).toBe(40 * U);
    const rectangle = {
      x: 6 * U,
      y: 6 * U,
      radius: 0,
      rect: { x: 5 * U, y: 5 * U, width: 2 * U, height: 2 * U },
    };
    expect(sweep({ x: 0, y: 0 }, { x: 10 * U, y: 10 * U }, rectangle)).not.toBeNull();
    expect(sweep({ x: 0, y: 4 * U }, { x: 10 * U, y: 4 * U }, rectangle)).toBeNull();
    expect(bodyDamage(40 * U, 20)).toBe(34133);
    expect(bodyDamage(40 * U, 60)).toBe(25 * U);
    expect(
      sweep({ x: 0, y: 0 }, { x: 10 * U, y: 0 }, { x: 5 * U, y: 0, radius: 358, rect: null }),
    ).not.toBeNull();
    expect(
      sweep({ x: 0, y: 0 }, { x: 10 * U, y: 0 }, { x: 5 * U, y: 2 * U, radius: 358, rect: null }),
    ).toBeNull();
  });
  it('pinned heading lookup roundtrips axes and diagonals', () => {
    for (const h of [0, 8192, 16384, 24576, 32768, 40960, 49152, 57344])
      expect(bearing(direction(h, U))).toBe(h);
  });
  it('the real tutorial wins, respects body separation, and matches every tick grouping', async () => {
    let expected = '';
    for (const batch of [1, 2, 4, 8, 12]) {
      const b = await Battle.create(army());
      let safety = 0;
      let mineWarning = false;
      let mineImpact = false;
      while ((b.state === 'Siege' || b.state === 'Cleanup') && safety++ < 16000) {
        for (let i = 0; i < batch; i++) {
          b.step();
          mineWarning ||= b.events.some((event) => event.kind === 'mine-warning');
          mineImpact ||= b.events.some(
            (event) =>
              event.kind === 'impact' &&
              b.get(event.source)?.type === 'friendly.proximity_mine' &&
              event.value > 0,
          );
        }
        for (const e of b.entities.filter((e) => e.hp > 0 && e.radius))
          for (const t of b.entities.filter((t) => t.hp > 0 && t.radius && t.id > e.id))
            expect(distance(e, t)).toBeGreaterThanOrEqual(e.radius + t.radius);
      }
      expect(b.state, b.reason).toBe('Victory');
      expect(mineWarning).toBe(true);
      expect(mineImpact).toBe(true);
      expect(b.kills).toBe(24);
      expect(b.destroyedTP).toBe(30);
      expect(b.tick).toBeGreaterThan(5100);
      expect(b.core.hp).toBeGreaterThan(0);
      const h = await hash(b.snapshot());
      if (!expected) expected = h;
      expect(h).toBe(expected);
    }
  }, 120000);
  it('inevitable defeat and surrender are recoverable terminal outcomes, not invented victory', async () => {
    const b = await Battle.create([]);
    for (let i = 0; i < 1000; i++) b.step();
    expect(b.state).toBe('Defeat');
    const end = await hash(b.snapshot());
    b.step();
    expect(await hash(b.snapshot())).toBe(end);
    const s = await Battle.create(army());
    s.step();
    s.surrender();
    expect(s.state).toBe('Defeat');
    expect(s.reason).toContain('surrender');
  });
});
