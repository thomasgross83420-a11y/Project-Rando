import { describe, expect, it } from 'vitest';
import art from '../../public/assets/combat/manifest.json';
import { type CombatID, combat, combatIDs } from '../../src/data/combat';
import {
  AnimationTimeline,
  actorAnimationFrame,
  animationTimelines,
  eventAnimationFrame,
} from '../../src/render/animation';
import { type Camera, project } from '../../src/render/projection';
import { Battle, type Entity } from '../../src/sim/battle';
import { hash } from '../../src/sim/determinism';
import { direction, U } from '../../src/sim/fixed';

async function actor(type: CombatID): Promise<Entity> {
  const base = (await Battle.create([])).core;
  return { ...base, type, hp: combat[type].hp, maxHP: combat[type].hp };
}

describe('animation behavior and authored contracts', () => {
  it('honors unequal authored frame durations, exact boundaries and terminal/loop behavior', () => {
    const t = new AnimationTimeline([
      { frame: 1, ticks: 3 },
      { frame: 0, ticks: 2 },
    ]);
    expect([0, 1, 2, 3, 4].map((age) => t.sample(age, 'once')?.frame)).toEqual([0, 0, 1, 1, 1]);
    expect(t.sample(-1, 'once')).toBeUndefined();
    expect(t.sample(5, 'once')).toBeUndefined();
    expect(t.sample(5, 'loop')?.frame).toBe(0);
    expect(t.sample(50000, 'clamp')?.frame).toBe(1);
    expect(() => t.sample(Number.NaN, 'loop')).toThrow('tick');
    expect(() => new AnimationTimeline([])).toThrow('Empty');
    expect(() => new AnimationTimeline([{ frame: 1, ticks: 5 }])).toThrow('contiguous');
    expect(() => new AnimationTimeline([{ frame: 0, ticks: 0 }])).toThrow('positive');
  });

  it('reaches every authored atlas frame for its full duration with no gaps or skipped last frame', () => {
    const reached = new Set<string>();
    for (const timeline of animationTimelines.values()) {
      let age = 0;
      for (const frame of timeline.frames) {
        expect(timeline.sample(age, 'once')?.key).toBe(frame.key);
        expect(timeline.sample(age + frame.ticks - 1, 'once')?.key).toBe(frame.key);
        reached.add(frame.key);
        age += frame.ticks;
      }
      expect(timeline.sample(age, 'once')).toBeUndefined();
      expect(timeline.sample(age, 'clamp')?.key).toBe(timeline.last.key);
      expect(timeline.sample(age, 'loop')?.key).toBe(timeline.first.key);
    }
    expect(reached.size).toBe(art.frames.length);
  });

  it('plays all six explosion frames through tick29, then expires; reduced effects retain the same lifetime', () => {
    const event = { kind: 'explosion', tick: 100 };
    for (let age = 0; age < 30; age++) {
      expect(eventAnimationFrame(event, 100 + age)?.frame).toBe(Math.floor(age / 5));
      expect(eventAnimationFrame(event, 100 + age, true)?.frame).toBe(0);
    }
    expect(eventAnimationFrame(event, 99)).toBeUndefined();
    expect(eventAnimationFrame(event, 130)).toBeUndefined();
    expect(eventAnimationFrame(event, 130, true)).toBeUndefined();
    for (const kind of ['impact', 'ability']) {
      expect(eventAnimationFrame({ kind, tick: 100 }, 119)?.frame).toBe(3);
      expect(eventAnimationFrame({ kind, tick: 100 }, 120)).toBeUndefined();
    }
    expect(eventAnimationFrame({ kind: 'shot', tick: 100 }, 100)).toBeUndefined();
  });

  it('matches eight principal projected facings in all four camera orientations for mobile units and Sentry', async () => {
    for (const type of combatIDs.filter(
      (id) => combat[id].radius > 0 || id === 'friendly.sentry',
    )) {
      const e = await actor(type);
      for (const view of [0, 1, 2, 3] as const) {
        const camera: Camera = { x: 0, y: 0, zoom: 1, view, width: 0, height: 0 };
        for (let heading = 0; heading < 65536; heading += 8192) {
          e.heading = heading;
          const v = direction(heading, U),
            screen = project({ x: v.x / U, y: v.y / U }, camera),
            expected = (Math.round(Math.atan2(screen.x, -screen.y) / (Math.PI / 4)) + 8) % 8;
          expect(actorAnimationFrame(e, 0, view).facing).toBe(expected);
        }
      }
    }
  });

  it('uses all four authored asymmetric static views and persistent terminal poses without looping death', async () => {
    for (const type of combatIDs) {
      const e = await actor(type),
        mobile = combat[type].radius > 0;
      for (const view of [0, 1, 2, 3] as const) {
        if (!mobile && type !== 'friendly.sentry')
          expect(actorAnimationFrame(e, 0, view).camera).toBe(view);
        e.hp = 0;
        e.deadTick = 50;
        expect(actorAnimationFrame(e, 50, view).frame).toBe(0);
        expect(actorAnimationFrame(e, 10000, view).frame).toBe(mobile ? 5 : 0);
        expect(actorAnimationFrame(e, 50, view, true).frame).toBe(mobile ? 5 : 0);
        e.hp = e.maxHP;
      }
    }
  });

  it('keeps the last hit frame for its full authored duration and never lets movement override death', async () => {
    const e = await actor('enemy.runner');
    e.lastHit = 100;
    e.lastMove = 115;
    expect(actorAnimationFrame(e, 115, 0).state).toBe('hit');
    expect(actorAnimationFrame(e, 115, 0).frame).toBe(1);
    expect(actorAnimationFrame(e, 116, 0).state).toBe('move');
    e.hp = 0;
    e.deadTick = 116;
    expect(actorAnimationFrame(e, 116, 0).state).toBe('incapacitated');
  });

  it('retains movement under reduced effects and static squad attack cues', async () => {
    const e = await actor('friendly.rifle_squad');
    e.lastMove = 13;
    expect(actorAnimationFrame(e, 13, 0, true).state).toBe('move');
    expect(actorAnimationFrame(e, 13, 0, true).frame).toBe(2);
    e.lastAction = 10;
    expect(actorAnimationFrame(e, 20, 0).state).toBe('attack');
    expect(actorAnimationFrame(e, 20, 0).frame).toBe(2);
    expect(actorAnimationFrame(e, 20, 0, true).frame).toBe(0);
  });

  it('selects support channel and Warden cast/release/dash cues, with death taking priority', async () => {
    const node = await actor('friendly.repair_node');
    node.state = 'Channeling';
    expect(actorAnimationFrame(node, 12, 2).key).toBe('friendly.repair_node.view2.channel.2');
    const warden = await actor('warden.bulwark');
    warden.cast = { ability: 2, release: 112, recipient: 0, point: { x: 0, y: 0 }, heading: 0 };
    expect(actorAnimationFrame(warden, 110, 0).state).toBe('ability');
    warden.cast = null;
    warden.lastAbility = 112;
    expect(actorAnimationFrame(warden, 117, 0).frame).toBe(1);
    warden.dash = { end: 130, recipient: 1, point: { x: 0, y: 0 }, heading: 0 };
    expect(actorAnimationFrame(warden, 128, 0).state).toBe('ability');
    warden.hp = 0;
    warden.deadTick = 128;
    expect(actorAnimationFrame(warden, 128, 0).state).toBe('incapacitated');
  });

  it('does not mutate authoritative battle state when sampling speed, pause, rotation or reduced presentation', async () => {
    const b = await Battle.create([]),
      before = await hash(b.snapshot());
    for (const tick of [0, 1, 5, 60, 600]) {
      for (const view of [0, 1, 2, 3] as const) {
        for (const reduced of [false, true]) {
          actorAnimationFrame(b.core, tick, view, reduced);
          eventAnimationFrame({ kind: 'explosion', tick: 0 }, tick, reduced);
        }
      }
    }
    expect(await hash(b.snapshot())).toBe(before);
  });
});
