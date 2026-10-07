import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle';
import { BattleClock } from '../../src/sim/clock';
import { tutorialPlan, tutorialSchema } from '../../src/sim/tutorial';
import { tutorialArmy } from '../fixtures/tutorial';
import { U, distance } from '../../src/sim/fixed';
import { hash } from '../../src/sim/determinism';
const steps = (b: Battle, n: number) => {
  for (let i = 0; i < n; i++) b.step();
};
describe('observable autonomous combat contracts', () => {
  const required = <T>(v: T | undefined): T => {
    if (v === undefined) throw new Error('Missing fixture object');
    return v;
  };
  it('rejects altered authored packets and duplicate army identities', async () => {
    const p = tutorialPlan();
    required(p.packets[0]).tp = 2;
    expect(() => tutorialSchema.parse(p)).toThrow();
    const a = tutorialArmy();
    await expect(Battle.create([required(a[0]), required(a[0])])).rejects.toThrow('Duplicate');
  });
  it('repairs living mechanical recipients after the first pulse, never biological allies or wrecks', async () => {
    const b = await Battle.create(tutorialArmy());
    const node = required(b.entities.find((e) => e.type === 'friendly.repair_node')),
      tower = required(b.entities.find((e) => e.type === 'friendly.sentry' && e.y > 30 * U)),
      rifle = required(b.entities.find((e) => e.type === 'friendly.rifle_squad'));
    tower.hp -= 100 * U;
    rifle.hp -= 100 * U;
    steps(b, 15);
    expect(tower.hp).toBe(tower.maxHP - 100 * U);
    b.step();
    expect(tower.hp).toBe(tower.maxHP - 100 * U + 6400);
    expect(rifle.hp).toBe(rifle.maxHP - 100 * U);
    tower.hp = 0;
    steps(b, 60);
    expect(tower.hp).toBe(0);
    expect(node.channel).not.toBe(tower.id);
  });
  it('Interpose performs a legal dash and grants one front shield without teleportation', async () => {
    const b = await Battle.create(tutorialArmy());
    steps(b, 961);
    const w = required(b.entities.find((e) => e.type === 'warden.bulwark')),
      r = required(b.entities.find((e) => e.type === 'friendly.rifle_squad')),
      host = b.entities.filter((e) => e.team === 'hostile' && e.hp > 0);
    expect(host.length).toBeGreaterThanOrEqual(3);
    w.x = 23 * U;
    w.y = 23 * U;
    w.anchor = { x: w.x, y: w.y };
    w.goal = null;
    r.x = 23 * U;
    r.y = 25 * U;
    r.anchor = { x: r.x, y: r.y };
    r.hp = 400 * U;
    host.slice(0, 3).forEach((e, i) => {
      e.x = (23 + i) * U;
      e.y = (i === 0 ? 24 : 25) * U;
      e.target = r.id;
      e.goal = null;
    });
    const start = { x: w.x, y: w.y };
    steps(b, 60);
    expect(b.events.some((e) => e.kind === 'ability' && e.message === 'Interpose released')).toBe(
      true,
    );
    expect(w.abilities[0]).toBeGreaterThan(b.tick);
    expect(r.shield.length).toBe(1);
    expect(r.shield[0]?.pool).toBeLessThanOrEqual(600 * U);
    expect(distance(start, w)).toBeLessThanOrEqual(5 * U);
    expect(r.hp).toBeGreaterThan(0);
  });
  it('Holdfast immediately protects nearby Core, expires on range loss, and Challenge affects only detected close threats', async () => {
    const field = await Battle.create(tutorialArmy()),
      w = field.entities.find((e) => e.type === 'warden.bulwark');
    if (!w) throw new Error('Fixture Warden missing');
    field.core.hp = (field.core.maxHP * 35) / 100;
    steps(field, 25);
    expect(w.fieldEnd).toBeGreaterThan(field.tick);
    expect(field.core.reduction).toBe(20);
    w.x = 40 * U;
    w.y = 40 * U;
    steps(field, 5);
    expect(field.core.reduction).toBe(0);
    const b = await Battle.create(tutorialArmy());
    steps(b, 961);
    const caster = b.entities.find((e) => e.type === 'warden.bulwark');
    if (!caster) throw new Error('Fixture Warden missing');
    caster.x = 23 * U;
    caster.y = 23 * U;
    caster.anchor = { x: caster.x, y: caster.y };
    b.entities
      .filter((e) => e.team === 'hostile' && e.hp > 0)
      .slice(0, 3)
      .forEach((e, i) => {
        e.x = ([22, 24, 23][i] ?? 0) * U;
        e.y = ([23, 23, 25][i] ?? 0) * U;
        e.target = 1;
        e.goal = null;
      });
    steps(b, 35);
    expect(caster.abilities[1]).toBeGreaterThan(b.tick);
    expect(b.entities.some((e) => e.challenge?.owner === caster.id)).toBe(true);
  });
  it('front shield absorbs raw damage before one armor rounding; a rear hit bypasses its pool', async () => {
    for (const front of [true, false]) {
      const b = await Battle.create([]);
      b.core.shield.push({ pool: 20 * U, expires: 100, heading: front ? 49152 : 16384, source: 8 });
      b.projectiles.push({
        id: 1,
        source: 99,
        team: 'hostile',
        target: 1,
        heading: 16384,
        speed: 24 * U,
        carryX: 0,
        carryY: 0,
        raw: 40 * U,
        traveled: 0,
        maxTravel: 10 * U,
        sequence: 1,
        release: { x: 27 * U, y: 30 * U },
        x: Math.round(27.9 * U),
        y: 30 * U,
      });
      b.step();
      expect(b.core.hp).toBe(b.core.maxHP - (front ? 17067 : 34133));
      expect(b.core.shield[0]?.pool).toBe(front ? 0 : 20 * U);
    }
  });
  it('released projectiles survive their owner, but canceled warmups never release', async () => {
    const b = await Battle.create(tutorialArmy());
    steps(b, 961);
    const tower = required(b.entities.find((e) => e.type === 'friendly.sentry')),
      enemy = required(b.entities.find((e) => e.team === 'hostile' && e.hp > 0));
    enemy.x = 21 * U;
    enemy.y = 27 * U;
    enemy.goal = null;
    tower.target = enemy.id;
    tower.heading = 49152;
    let guard = 0;
    while (!b.projectiles.some((p) => p.source === tower.id) && guard++ < 80) b.step();
    const shot = b.projectiles.find((p) => p.source === tower.id);
    expect(shot).toBeDefined();
    const before = enemy.hp;
    tower.hp = 0;
    steps(b, 30);
    expect(enemy.hp).toBeLessThan(before);
    const c = await Battle.create(tutorialArmy());
    const warm = required(c.entities.find((e) => e.type === 'friendly.sentry'));
    warm.warmup = 0;
    warm.hp = 0;
    steps(c, 12);
    expect(c.projectiles.some((p) => p.source === warm.id)).toBe(false);
  });
  it('victory waits for future packets and a hostile projectile; Core death takes precedence', async () => {
    const b = await Battle.create(tutorialArmy());
    steps(b, 600);
    for (const e of b.entities) if (e.team === 'hostile') e.hp = 0;
    steps(b, 60);
    expect(b.state).toBe('Siege');
    b.packet = 24;
    b.projectiles.push({
      id: 9000,
      source: 1001,
      team: 'hostile',
      target: 1,
      heading: 0,
      speed: U,
      carryX: 0,
      carryY: 0,
      raw: U,
      traveled: 0,
      maxTravel: 60 * U,
      sequence: 9000,
      release: { x: 50 * U, y: 50 * U },
      x: 50 * U,
      y: 50 * U,
    });
    steps(b, 70);
    expect(b.state).toBe('Siege');
    b.core.hp = 0;
    b.projectiles = [];
    b.step();
    expect(b.state).toBe('Defeat');
  });
  it('clock freezes absence, keeps bounded work/backlog, and every supported speed preserves exact ticks', async () => {
    const outcomes = [];
    for (const speed of [0.5, 1, 2, 4] as const) {
      const b = await Battle.create([]),
        clock = new BattleClock(
          () => b.step(),
          () => {},
        );
      clock.speed = speed;
      clock.frame(0);
      for (let i = 1; i <= 120 / speed; i++) clock.frame((i * 1000) / 60);
      outcomes.push(await hash(b.snapshot()));
      clock.pause('background');
      const before = b.tick;
      clock.frame(100000);
      expect(b.tick).toBe(before);
      expect(clock.backlog).toBe(0);
      clock.clear('modal');
      expect(clock.pauses.has('background')).toBe(true);
      clock.resume();
      clock.frame(200000);
      expect(b.tick).toBe(before);
    }
    expect(new Set(outcomes).size).toBe(1);
  });
});
