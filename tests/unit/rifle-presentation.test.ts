import { describe, expect, it } from 'vitest';
import landmarks from '../../assets/source/combat/rifle-landmarks.json';
import { combat } from '../../src/data/combat';
import { actorAnimationFrame } from '../../src/render/animation';
import { MotionTracker } from '../../src/render/motion';
import { type Camera, fitCombatStart, project } from '../../src/render/projection';
import { rifleCrop, rifleLayers, riflePose, rifleProjectileOffset } from '../../src/render/rifle';
import { Battle } from '../../src/sim/battle';
import { hash } from '../../src/sim/determinism';

async function rifle() {
  const b = await Battle.create([]);
  return {
    ...b.core,
    id: 3,
    type: 'friendly.rifle_squad' as const,
    hp: combat['friendly.rifle_squad'].hp,
    maxHP: combat['friendly.rifle_squad'].hp,
    lastMove: 100,
    lastAction: 100,
    lastRelease: 100,
    heading: 0,
  };
}
describe('Rifle joint, contact and real-release presentation', () => {
  it('captures each projectile release once so parent turns cannot drag its muzzle origin, and retires expired cues', async () => {
    const e = await rifle(),
      m = new MotionTracker();
    const p = {
      id: 99,
      source: e.id,
      team: e.team,
      target: 1,
      x: e.x,
      y: e.y,
      heading: 0,
      speed: 22528,
      carryX: 0,
      carryY: 0,
      raw: 27 * 1024,
      traveled: 0,
      maxTravel: 8 * 1024,
      sequence: 99,
      release: { x: e.x, y: e.y },
    };
    m.observe([e], 100, [p]);
    const cue = m.projectile(p.id);
    if (!cue) throw Error('Missing shot cue');
    const camera: Camera = { x: 0, y: 0, zoom: 1, view: 0, width: 800, height: 700 };
    const before = rifleProjectileOffset(cue, 0, camera, 60);
    expect(before.y).toBeLessThan(-8);
    const end = rifleProjectileOffset(cue, cue.distance, camera, 60);
    expect(end).toEqual({ x: 0, y: -13.5 });
    e.heading = 32768;
    m.observe([e], 101, [p]);
    expect(m.projectile(p.id)).toEqual(cue);
    expect(rifleProjectileOffset(m.projectile(p.id)!, 0, camera, 60)).toEqual(before);
    m.observe([e], 102, []);
    expect(m.projectile(p.id)).toBeUndefined();
  });
  it('keeps loaded soles stationary in world space at the authored keys in every heading, including cycle wrap', () => {
    for (let face = 0; face < 8; face++) {
      for (let side = 0; side < 2; side++) {
        let previous: number | undefined;
        for (let key = 0; key < 16; key++) {
          const pose =
            landmarks.frameKeys[
              `friendly.rifle_squad.face${face}.move.${key % 8}` as keyof typeof landmarks.frameKeys
            ];
          const foot = pose.contacts[side]!;
          if (!foot.planted) {
            previous = undefined;
            continue;
          }
          expect(foot.heightGU).toBe(0);
          const world =
            (key * 5 * combat['friendly.rifle_squad'].speed) / 1024 / 60 + foot.forwardGU;
          if (previous !== undefined) expect(Math.abs(world - previous)).toBeLessThan(0.000002);
          previous = world;
        }
      }
    }
  });
  it('separates every aim/travel pair in every camera while maintaining the fixed foot anchor and waist landmark', async () => {
    const e = await rifle();
    for (const view of [0, 1, 2, 3] as const)
      for (let aim = 0; aim < 65536; aim += 8192)
        for (let travel = 0; travel < 65536; travel += 8192) {
          e.heading = aim;
          const p = rifleLayers(e, 100, view, 17, travel, 0, 0);
          expect(p.upper.facing).toBe((aim / 8192 + 1 + view * 2) % 8);
          expect(p.lower?.facing).toBe((travel / 8192 + 1 + view * 2) % 8);
          expect(p.lower?.state).toBe('move');
          expect(p.lower?.anchor).toEqual(p.upper.anchor);
          expect(riflePose(p.upper).splitY).toBe(34);
          for (const part of ['upper', 'lower'] as const) {
            const f = part === 'upper' ? p.upper : p.lower!;
            const crop = rifleCrop(f, part);
            expect(crop.y + crop.height).toBeLessThanOrEqual(f.rect[3]!);
            expect(crop.height).toBeGreaterThan(0);
          }
        }
  });
  it('shows one member recoil/muzzle per actual release, expires on simulation ticks and suppresses it with reduced effects', async () => {
    const e = await rifle();
    for (let firing = 0; firing < 3; firing++) {
      const sample = (tick: number, reduced = false) =>
        [0, 1, 2].map((member) => rifleLayers(e, tick, 0, 11, 32768, member, firing, reduced));
      expect(sample(100).filter((p) => p.upper.state === 'attack')).toHaveLength(1);
      expect(sample(103).filter((p) => p.muzzle)).toHaveLength(1);
      expect(sample(104).filter((p) => p.muzzle)).toHaveLength(0);
      expect(sample(100, true).filter((p) => p.muzzle)).toHaveLength(0);
      e.lastRelease = -100000;
      expect(sample(100).filter((p) => p.muzzle)).toHaveLength(0);
      e.lastRelease = 100;
    }
  });
  it('tracks displacement direction, freezes gait when blocked, and cycles firing identity from observed releases rather than elapsed time', async () => {
    const e = await rifle(),
      m = new MotionTracker();
    e.lastRelease = -100000;
    m.observe([e], 0);
    e.x += 100;
    e.lastMove = 1;
    e.lastRelease = 1;
    m.observe([e], 1);
    expect(m.heading(e.id)).toBe(16384);
    expect(m.firingMember(e.id)).toBe(0);
    const phase = m.sample(e.id);
    for (let tick = 2; tick < 90; tick++) m.observe([e], tick);
    expect(m.sample(e.id)).toBe(phase);
    expect(m.firingMember(e.id)).toBe(0);
    e.lastRelease = 90;
    m.observe([e], 90);
    expect(m.firingMember(e.id)).toBe(1);
    e.lastRelease = 200;
    m.observe([e], 200);
    expect(m.firingMember(e.id)).toBe(2);
    e.lastRelease = 245;
    m.observe([e], 245);
    expect(m.firingMember(e.id)).toBe(0);
  });
  it('holds grounded bracing after stopping, keeps a single whole terminal pose, and cannot mutate simulation state', async () => {
    const e = await rifle(),
      before = await hash(e);
    e.lastMove = 20;
    for (const view of [0, 1, 2, 3] as const) {
      const p = rifleLayers(e, 100, view, 17, 32768, 0, 0);
      expect(p.lower?.state).toBe('brace');
    }
    e.lastMove = 100;
    expect(await hash(e)).toBe(before);
    e.hp = 0;
    e.deadTick = 100;
    const p = rifleLayers(e, 10000, 0, 17, 0, 0, 0);
    expect(p.lower).toBeNull();
    expect(p.muzzle).toBeNull();
    expect(p.upper.frame).toBe(5);
    expect(actorAnimationFrame(e, 10000, 0, true)).toEqual(p.upper);
  });
  it('frames a normal deployment as detailed combat and keeps all defenders inside the viewport in every camera', () => {
    const defenders = [
      { x: 30, y: 30 },
      { x: 27, y: 25 },
      { x: 32, y: 25 },
      { x: 34, y: 30 },
    ];
    for (const view of [0, 1, 2, 3] as const)
      for (const [width, height] of [
        [360, 430],
        [800, 1050],
        [1280, 570],
      ]) {
        const camera: Camera = { x: 0, y: 0, zoom: 1, view, width: width!, height: height! };
        fitCombatStart(camera, defenders);
        expect(camera.zoom).toBeGreaterThan(0.65);
        for (const point of defenders) {
          const p = project(point, camera);
          expect(p.x).toBeGreaterThan(12);
          expect(p.x).toBeLessThan(camera.width - 12);
          expect(p.y).toBeGreaterThan(36);
          expect(p.y).toBeLessThan(camera.height - 12);
        }
      }
  });
});
