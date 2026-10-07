import art from '../../public/assets/combat/manifest.json';
import { combat } from '../data/combat';
import type { BattleEvent, Entity } from '../sim/battle';
import type { Camera } from './projection';

export type CombatFrame = (typeof art.frames)[number];
export type Playback = 'loop' | 'clamp' | 'once';
interface TimedFrame {
  frame: number;
  ticks: number;
}

/** Compile once. Sampling uses authoritative ticks, never a render/audio clock. */
export class AnimationTimeline<T extends TimedFrame> {
  readonly frames: readonly T[];
  readonly duration: number;
  readonly first: T;
  readonly last: T;
  private readonly ends: number[] = [];
  constructor(input: readonly T[]) {
    const frames = [...input].sort((a, b) => a.frame - b.frame);
    const first = frames[0],
      last = frames.at(-1);
    if (!first || !last) throw new Error('Empty animation');
    let duration = 0;
    for (const [index, frame] of frames.entries()) {
      if (frame.frame !== index || !Number.isSafeInteger(frame.ticks) || frame.ticks < 1)
        throw new Error('Animation requires contiguous frames and positive integer tick durations');
      duration += frame.ticks;
      if (!Number.isSafeInteger(duration)) throw new Error('Animation duration overflow');
      this.ends.push(duration);
    }
    this.frames = frames;
    this.first = first;
    this.last = last;
    this.duration = duration;
  }
  sample(elapsed: number, playback: Playback): T | undefined {
    if (!Number.isSafeInteger(elapsed)) throw new Error('Invalid animation tick');
    if (playback === 'once' && (elapsed < 0 || elapsed >= this.duration)) return;
    const tick =
      playback === 'loop'
        ? Math.max(0, elapsed) % this.duration
        : Math.min(this.duration - 1, Math.max(0, elapsed));
    return this.frames[this.ends.findIndex((end) => tick < end)];
  }
}

const groups = new Map<string, CombatFrame[]>();
for (const frame of art.frames) {
  const prefix = frame.key.slice(0, frame.key.lastIndexOf('.'));
  const group = groups.get(prefix) ?? [];
  group.push(frame);
  groups.set(prefix, group);
}
export const animationTimelines = new Map(
  [...groups].map(([prefix, frames]) => [prefix, new AnimationTimeline(frames)] as const),
);
export function animationTimeline(prefix: string): AnimationTimeline<CombatFrame> {
  const timeline = animationTimelines.get(prefix);
  if (!timeline) throw new Error(`Missing actual animation ${prefix}`);
  return timeline;
}

export function actorAnimationFrame(
  e: Entity,
  tick: number,
  view: Camera['view'],
  reduced = false,
  movePhase?: number,
): CombatFrame {
  const mobile = combat[e.type].radius > 0;
  const face = (Math.floor((e.heading + 4096) / 8192) + 1 + view * 2) % 8;
  const pose = mobile || e.type === 'friendly.sentry' ? `face${face}` : `view${view}`;
  const prefix = `${e.type}.${pose}`;
  let state = 'idle',
    start = 0;
  if (e.hp === 0) {
    state = mobile ? 'incapacitated' : 'wreck';
    start = e.deadTick ?? tick;
  } else if (
    e.cast ||
    e.dash ||
    (e.type === 'warden.bulwark' &&
      e.lastAbility >= 0 &&
      tick - e.lastAbility < animationTimeline(`${prefix}.ability`).duration - 12)
  ) {
    state = 'ability';
    start = e.cast ? e.cast.release - 12 : e.lastAbility - 12;
  } else if (
    combat[e.type].weapon &&
    e.lastAction > tick - animationTimeline(`${prefix}.attack`).duration
  ) {
    state = 'attack';
    start = e.lastAction;
  } else if (e.lastHit > tick - animationTimeline(`${prefix}.hit`).duration) {
    state = 'hit';
    start = e.lastHit;
  } else if (e.state === 'Channeling') {
    state = 'channel';
    start = e.channelCommit - 30;
  } else if (mobile && e.lastMove >= tick - 2) {
    state = 'move';
  } else if (mobile && e.state === 'Aiming') {
    state = 'aim';
  }
  const timeline = animationTimeline(`${prefix}.${state}`);
  if (reduced && state !== 'move') return e.hp === 0 ? timeline.last : timeline.first;
  const elapsed = state === 'move' && movePhase !== undefined ? movePhase : tick - start;
  const frame = timeline.sample(elapsed, e.hp === 0 || state === 'ability' ? 'clamp' : 'loop');
  if (!frame) throw new Error('Missing actor frame');
  return frame;
}

export function eventAnimationFrame(
  event: Pick<BattleEvent, 'kind' | 'tick'>,
  tick: number,
  reduced = false,
): CombatFrame | undefined {
  const kind =
    event.kind === 'explosion'
      ? 'explosion'
      : event.kind === 'ability'
        ? 'shield'
        : event.kind === 'impact'
          ? 'impact'
          : undefined;
  if (!kind) return;
  const timeline = animationTimeline(`fx.${kind}`);
  const frame = timeline.sample(tick - event.tick, 'once');
  return frame && reduced ? timeline.first : frame;
}
