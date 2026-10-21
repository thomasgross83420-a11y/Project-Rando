import { it, expect } from 'vitest';
import { findPath } from '../../src/game/navigation';
import { edgeClear } from '../../src/construction/geometry';
import { newGame, maxHealth, assertGame } from '../../src/game/model';
import { guidedLayout, validateLayout } from '../../src/game/construction';
import { maintenance, nextObjective, roleSummary } from '../../src/game/presentation';
import { FRIENDLIES, definition } from '../../src/game/catalog';
const fx = (n: number) => Math.round(n * 1024);
it('connects a route to an exact goal between grid centers without searching the whole field', () => {
  const start = { x: 15360, y: 15360 },
    goal = { x: 25600, y: 15360 },
    solids = [{ x: 19456, y: 12288, width: 1024, height: 5120 }];
  let evaluated = 0;
  const path = findPath(start, goal, 358, solids, 1, () => {
    evaluated++;
    return 1000;
  });
  expect(path.at(-1)).toEqual(goal);
  expect(evaluated).toBeLessThan(1000);
  for (let i = 0; i < path.length; i++)
    expect(edgeClear(i ? path[i - 1]! : start, path[i]!, 358, solids)).toBe(true);
});
it('escapes an obstacle edge even when the containing cell center is blocked', () => {
  const start = { x: fx(29.8466796875), y: fx(43.4609375) },
    goal = { x: fx(34.74), y: fx(35.43) },
    r = fx(0.45),
    solids = [{ x: fx(29), y: fx(42), width: 1024, height: 1024 }];
  expect(edgeClear(start, start, r, solids)).toBe(true);
  expect(edgeClear({ x: fx(29.75), y: fx(43.25) }, { x: fx(29.75), y: fx(43.25) }, r, solids)).toBe(
    false,
  );
  const path = findPath(start, goal, r, solids);
  expect(path.length).toBeGreaterThan(0);
  for (let i = 0; i < path.length; i++)
    expect(edgeClear(i ? path[i - 1]! : start, path[i]!, r, solids)).toBe(true);
  expect(Math.hypot(path.at(-1)!.x - goal.x, path.at(-1)!.y - goal.y)).toBeLessThanOrEqual(256);
  expect(findPath(start, goal, r, solids)).toEqual(path);
});
it('cached clearance respects both body radius and changed obstacles', () => {
  const start = { x: 15360, y: 15360 },
    goal = { x: 25600, y: 15360 };
  for (const r of [358, 768])
    for (const y of [12, 14]) {
      const solids = [{ x: 19456, y: fx(y), width: 1024, height: 5120 }],
        path = findPath(start, goal, r, solids);
      expect(path.length).toBeGreaterThan(0);
      for (let i = 0; i < path.length; i++)
        expect(edgeClear(i ? path[i - 1]! : start, path[i]!, r, solids)).toBe(true);
    }
});
it('all 54 starter/front combinations are legal, free and repeatable', () => {
  for (const d of ['Bastion', 'Mobile', 'Chokepoint'] as const)
    for (const w of ['warden.bulwark', 'warden.ranger', 'warden.conductor'])
      for (let front = 0; front < 6; front++) {
        const s = newGame('Layout', 0, d, w),
          ids = s.assets.map((a) => a.id);
        guidedLayout(s, front);
        expect(validateLayout(s)).toEqual([]);
        assertGame(s);
        expect(s.credits).toBe(600);
        expect(s.assets.map((a) => a.id)).toEqual(ids);
        const first = structuredClone(s.assets);
        guidedLayout(s, front);
        expect(s.assets).toEqual(first);
      }
});
it('restoration quotes include wreck revival, full healing and charges and commit atomically', () => {
  const s = newGame('Repair', 0, 'Bastion', 'warden.bulwark');
  guidedLayout(s);
  s.coreHP = fx(9000);
  s.assets[0]!.hp = 0;
  const trap = s.assets.find((a) => a.charges !== null)!;
  trap.charges = 0;
  s.credits = 10000;
  const quote = maintenance(s);
  expect(s.assets[0]!.hp).toBe(0);
  maintenance(s, true);
  expect(s.credits).toBe(10000 - quote.cost);
  expect(s.coreHP).toBe(fx(10000));
  expect(s.assets.every((a) => !a.placement || a.hp === maxHealth(a))).toBe(true);
  expect(s.assets.find((a) => a.id === trap.id)!.charges).toBe(definition(trap.type).charges);
  expect(maintenance(s).cost).toBe(0);
  s.assets[0]!.hp = 0;
  s.credits = 0;
  const before = structuredClone(s);
  expect(() => maintenance(s, true)).toThrow('Credits');
  expect(s).toEqual(before);
});
it('objectives advance and explain rank gates with concise roles throughout the roster', () => {
  const s = newGame('Objective', 0, 'Bastion', 'warden.bulwark');
  expect(nextObjective(s)).toMatchObject({ stage: 0, mode: 'Campaign' });
  s.stages = [0];
  expect(nextObjective(s).mode).toBe('Expedition');
  s.rank = 2;
  expect(nextObjective(s)).toMatchObject({ stage: 1, mode: 'Campaign' });
  for (const d of FRIENDLIES) expect(roleSummary(d.id).length).toBeLessThan(180);
});
it('Endurance chooses bosses from the declared band even with a higher ranked army', async () => {
  const { compile } = await import('../../src/game/director');
  for (const band of [6, 10, 15]) {
    const p = await compile({
      mode: 'Endurance',
      rank: 100,
      band,
      blocks: 6,
      seed: 'endurance-band-regression',
      difficulty: 'Standard',
    });
    for (const block of [p, ...p.following]) {
      expect(block.requiredRank).toBe(band * 5);
      if (block.boss) expect(definition(block.boss).rank).toBeLessThanOrEqual(band * 5);
    }
  }
});
it('touch and precise rally points reject blocked Core ground and preserve the deployment', async () => {
  const { validateRallyPoint } = await import('../../src/game/rally');
  const s = newGame('Rally', 0, 'Bastion', 'warden.bulwark');
  guidedLayout(s);
  const a = s.assets.find((a) => a.type === 'friendly.rifle_squad')!,
    before = structuredClone(a);
  expect(() => validateRallyPoint(s, a, { x: 30, y: 30 })).toThrow('blocked');
  expect(() => validateRallyPoint(s, a, { x: 26, y: 32 })).not.toThrow();
  expect(a).toEqual(before);
});
it('reviewed facing places rapid fire on the busy lane and resets headings when fronts change', async () => {
  const { buy } = await import('../../src/game/construction'),
    { ENTRANCES } = await import('../../src/construction/geometry');
  const s = newGame('Fire lanes', 0, 'Mobile', 'warden.bulwark');
  s.rank = 7;
  s.credits = 5000;
  buy(s, 'friendly.rotary');
  buy(s, 'friendly.sentry');
  guidedLayout(s, 1);
  assertGame(s);
  expect(validateLayout(s)).toEqual([]);
  const front = ENTRANCES[1]!,
    range = (a: (typeof s.assets)[number]) => {
      const p = a.placement!;
      return (p.x + 1 - front.x) ** 2 + (p.y + 1 - front.y) ** 2;
    },
    rotary = s.assets.find((a) => a.type === 'friendly.rotary')!;
  for (const a of s.assets.filter((a) => a.type === 'friendly.sentry'))
    expect(range(rotary)).toBeLessThanOrEqual(range(a));
  guidedLayout(s, 5);
  guidedLayout(s, 0);
  expect(s.assets.filter((a) => a.placement).every((a) => a.tactics.heading === 270)).toBe(true);
  assertGame(s);
});
it('practice preserves a stored selected Warden instead of silently adding it to the deployed force', async () => {
  const { practiceClone } = await import('../../src/game/practice'),
    { compile } = await import('../../src/game/director');
  const s = newGame('Clone', 0, 'Bastion', 'warden.bulwark');
  guidedLayout(s);
  s.assets.find((a) => a.type === s.warden)!.placement = null;
  const p = await compile({
      mode: 'Calibration',
      rank: 1,
      seed: 'stored-warden',
      difficulty: 'Standard',
    }),
    c = practiceClone(
      s,
      {
        fullRepair: true,
        capacity: 120,
        barriers: 200,
        traps: 40,
        warden: s.warden,
        flipBranches: false,
        exclusions: [],
      },
      p,
    );
  expect(c.assets.map((a) => a.placement)).toEqual(s.assets.map((a) => a.placement));
});
it('the guided Mobile force actually deploys a newly unlocked Heavy Squad and remains within capacity', async () => {
  const { buy, usage, limits } = await import('../../src/game/construction');
  const s = newGame('Mobile growth', 0, 'Mobile', 'warden.bulwark');
  s.rank = 7;
  s.credits = 5000;
  for (const type of [
    'friendly.sentry',
    'friendly.rifle_squad',
    'friendly.rotary',
    'friendly.heavy_squad',
  ])
    buy(s, type);
  guidedLayout(s);
  assertGame(s);
  expect(validateLayout(s)).toEqual([]);
  expect(s.assets.find((a) => a.type === 'friendly.heavy_squad')!.placement).not.toBeNull();
  expect(usage(s).capacity).toBeLessThanOrEqual(limits(s).capacity);
});
