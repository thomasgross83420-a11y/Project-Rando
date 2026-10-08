import rig from '../../public/assets/combat/rifle-rig.json';
import type { Entity } from '../sim/battle';
import { actorAnimationFrame, animationTimeline, type CombatFrame } from './animation';
import { type Camera, type Point, project } from './projection';

export const rifleFormation: readonly Point[] = [
  { x: -0.25, y: -0.12 },
  { x: 0.25, y: -0.12 },
  { x: 0, y: 0.24 },
];
type RigPose = {
  sockets: { muzzle: number[] };
  splitY: number;
  bobPixels: number;
  soles: { x: number; y: number; planted: boolean }[];
};
const poses: Readonly<Record<string, RigPose>> = rig.frameKeys;
export function riflePose(frame: CombatFrame): RigPose {
  const pose = poses[frame.key];
  if (!pose) throw new Error(`Missing authored Rifle pose ${frame.key}`);
  return pose;
}
export function rifleLayers(
  e: Entity,
  tick: number,
  view: Camera['view'],
  phase: number,
  travelHeading: number,
  member: number,
  firingMember: number,
  reduced = false,
): { upper: CombatFrame; lower: CombatFrame | null; muzzle: number[] | null } {
  if (e.type !== 'friendly.rifle_squad' || member < 0 || member > 2)
    throw new Error('Rifle presentation identity');
  const current = actorAnimationFrame(e, tick, view, reduced, phase);
  if (e.hp === 0) return { upper: current, lower: null, muzzle: null };
  const face = current.facing;
  let upper = current;
  if (current.state === 'move' || (current.state === 'attack' && member !== firingMember))
    upper = animationTimeline(`friendly.rifle_squad.face${face}.aim`).first;
  const travelFace = (Math.floor((travelHeading + 4096) / 8192) + 1 + view * 2) % 8;
  const moving = e.lastMove >= tick - 2;
  const lower = animationTimeline(
    `friendly.rifle_squad.face${travelFace}.${moving ? 'move' : 'brace'}`,
  ).sample(Math.floor(phase + (member * rig.cycleTicks) / 3), 'loop');
  if (!lower) throw new Error('Missing Rifle gait');
  return {
    upper,
    lower,
    muzzle:
      !reduced &&
      member === firingMember &&
      e.lastRelease >= 0 &&
      tick >= e.lastRelease &&
      tick - e.lastRelease < 4
        ? riflePose(upper).sockets.muzzle
        : null,
  };
}

/** Authored waist landmark, in trimmed texture coordinates. Cropping retains
 * the full-frame foot anchor; physics/picking never use this decorative crop. */
export function rifleCrop(frame: CombatFrame, part: 'upper' | 'lower') {
  const y = Math.max(
    0,
    Math.min(frame.rect[3] ?? 0, riflePose(frame).splitY - (frame.trim[1] ?? 0)),
  );
  const height = frame.rect[3] ?? 0;
  return {
    x: 0,
    y: part === 'upper' ? 0 : y,
    width: frame.rect[2] ?? 0,
    height: part === 'upper' ? y : height - y,
  };
}

/** Straight cosmetic tracer from the captured member's weapon socket toward
 * body height. Swept collision, accuracy and damage stay in the ground model. */
export function rifleProjectileOffset(
  cue: { heading: number; member: number; distance: number },
  traveled: number,
  camera: Camera,
  targetAnchorY: number,
): Point {
  const face = (Math.floor((cue.heading + 4096) / 8192) + 1 + camera.view * 2) % 8;
  const frame = animationTimeline(`friendly.rifle_squad.face${face}.attack`).first;
  const muzzle = riflePose(frame).sockets.muzzle;
  const member = rifleFormation[cue.member];
  if (!member) throw new Error('Invalid firing member');
  const zero = { ...camera, x: 0, y: 0, width: 0, height: 0 };
  const spread = project(member, zero);
  const alpha = Math.min(1, Math.max(0, traveled / Math.max(1, cue.distance)));
  return {
    x: (spread.x + (((muzzle[0] ?? 24) - 24) * camera.zoom) / 2) * (1 - alpha),
    y:
      (spread.y + (((muzzle[1] ?? 51) - 51) * camera.zoom) / 2) * (1 - alpha) -
      ((targetAnchorY * 0.45 * camera.zoom) / 2) * alpha,
  };
}
