import { describe, expect, it } from 'vitest';
import { Battle, type Entity } from '../../src/sim/battle';
import { angleError, bearing, direction, distance, H, TRIG, U } from '../../src/sim/fixed';
import { actorAnimationFrame } from '../../src/render/animation';
import { project, unproject } from '../../src/render/projection';
import { combat } from '../../src/data/combat';
import { tutorialArmy } from '../fixtures/tutorial';

describe('full-angle travel independent of sprite facings', () => {
  it('every pinned heading roundtrips, including intermediate angles and wraparound', () => {
    let worst = 0;
    for (let h = 0; h < H; h++) {
      worst = Math.max(worst, angleError(h, bearing(direction(h, TRIG))));
      if (direction(h + H).x !== direction(h).x || direction(h - H).y !== direction(h).y)
        throw new Error(`Wrap mismatch at ${h}`);
    }
    expect(worst).toBe(0);
  });
  it('actual Rifle and Bulwark motion reaches fractional anchors around a full circle without eight-way snapping or diagonal speed inflation', async () => {
    const observations: number[] = [];
    for (const type of ['friendly.rifle_squad', 'warden.bulwark'] as const) {
      let min = Infinity,
        max = 0;
      for (let i = 0; i < 48; i++) {
        const h = Math.round(((i + 0.27) * H) / 48) % H;
        const a = tutorialArmy().find((a) => a.type === type);
        if (!a) throw new Error('Missing mobile fixture');
        const b = await Battle.create([{ ...a, x: 19, y: 19 }]);
        const e = b.entities.find((e) => e.type === type);
        if (!e) throw new Error('Missing actor');
        const start = { x: e.x, y: e.y },
          offset = direction(h, 3 * U);
        e.anchor = { x: e.x + offset.x, y: e.y + offset.y };
        for (let n = 0; n < 60; n++) b.step();
        const moved = distance(start, e);
        min = Math.min(min, moved);
        max = Math.max(max, moved);
        expect(angleError(h, bearing({ x: e.x - start.x, y: e.y - start.y }))).toBeLessThan(16);
        expect(moved).toBeGreaterThan(U);
        for (let n = 0; n < 90; n++) b.step();
        expect(distance(e, e.anchor)).toBeLessThan(12);
        observations.push(bearing({ x: e.x - start.x, y: e.y - start.y }));
      }
      expect(max - min).toBeLessThan(5);
    }
    expect(new Set(observations).size).toBeGreaterThanOrEqual(48);
  }, 60000);
  it('the production movement solver accepts fractional headings for every currently implemented mobile body', async () => {
    const b = await Battle.create(tutorialArmy().filter((a) => a.type === 'friendly.rifle_squad'));
    const e = b.entities.find((e) => e.type === 'friendly.rifle_squad');
    if (!e) throw new Error('Missing movement fixture');
    // Isolate the actual solver from target/ability decisions, like the combat
    // collision fixtures; this does not add a player tactical control.
    const solver = b as unknown as { move(actor: Entity): void };
    for (const type of [
      'friendly.rifle_squad',
      'warden.bulwark',
      'enemy.runner',
      'enemy.raider',
    ] as const) {
      let min = Infinity,
        max = 0;
      for (let i = 0; i < 48; i++) {
        e.type = type;
        e.radius = combat[type].radius;
        e.hp = combat[type].hp;
        e.x = 20 * U;
        e.y = 20 * U;
        e.carryX = 0;
        e.carryY = 0;
        e.lastProgress = b.tick;
        e.lastMove = b.tick;
        e.progressPoint = { x: e.x, y: e.y };
        const start = { x: e.x, y: e.y },
          h = Math.round(((i + 0.37) * H) / 48),
          v = direction(h, 5 * U);
        e.goal = { x: e.x + v.x, y: e.y + v.y };
        for (let t = 0; t < 60; t++) {
          b.tick++;
          solver.move(e);
        }
        const travelled = distance(start, e);
        min = Math.min(min, travelled);
        max = Math.max(max, travelled);
        expect(Math.abs(travelled - combat[type].speed)).toBeLessThan(4);
        expect(angleError(h, bearing({ x: e.x - start.x, y: e.y - start.y }))).toBeLessThan(16);
      }
      expect(max - min).toBeLessThan(5);
    }
  });
  it('all angles project correctly through every camera and retain complete eight-facing presentation coverage', async () => {
    const b = await Battle.create(tutorialArmy());
    const e = b.entities.find((e) => e.type === 'friendly.rifle_squad');
    if (!e) throw new Error('Missing Rifle');
    e.lastMove = 10;
    for (const view of [0, 1, 2, 3] as const) {
      const faces = new Set<number>();
      const camera = { x: 30, y: 30, width: 800, height: 1280, zoom: 1.35, view };
      for (let i = 0; i < 256; i++) {
        e.heading = i * 256;
        const v = direction(e.heading, 5 * U),
          point = { x: 30 + v.x / U, y: 30 + v.y / U };
        const actual = unproject(project(point, camera), camera);
        expect(actual.x).toBeCloseTo(point.x, 10);
        expect(actual.y).toBeCloseTo(point.y, 10);
        const facing = actorAnimationFrame(e, 10, view, false, 0).facing;
        if (typeof facing !== 'number') throw new Error('Missing mobile facing');
        faces.add(facing);
      }
      expect(faces.size).toBe(8);
    }
  });
});
