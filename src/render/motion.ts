import { combat } from '../data/combat';
import type { Entity, Projectile } from '../sim/battle';
import { bearing, distance } from '../sim/fixed';

interface PoseMotion {
  x: number;
  y: number;
  tick: number;
  phase: number;
  previous: number;
  dash: boolean;
  heading: number;
  lastRelease: number;
  releases: number;
}

/** Observe every authoritative step. Presentation cadence never reads wall time.
 * Nominal motion retains the authored 10fps cadence; slower/blocked motion slows
 * or freezes the gait. A dash uses its ability pose and never drives walk phase.
 */
export class MotionTracker {
  private readonly poses = new Map<number, PoseMotion>();
  private readonly shots = new Map<number, { heading: number; member: number; distance: number }>();
  observe(
    entities: readonly Entity[],
    tick: number,
    projectiles: readonly Projectile[] = [],
  ): void {
    for (const e of entities) {
      const d = combat[e.type];
      if (!d.radius) continue;
      const old = this.poses.get(e.id);
      if (!old || tick < old.tick) {
        this.poses.set(e.id, {
          x: e.x,
          y: e.y,
          tick,
          phase: 0,
          previous: 0,
          dash: !!e.dash,
          heading: e.heading,
          lastRelease: e.lastRelease,
          releases: e.lastRelease >= 0 ? 1 : 0,
        });
        continue;
      }
      if (tick === old.tick) continue;
      old.previous = old.phase;
      const moved = distance(e, old);
      if (e.hp > 0 && !e.dash && !old.dash && !e.cast && e.lastMove === tick && d.speed > 0) {
        old.phase += (moved * 60) / d.speed;
        if (moved) old.heading = bearing({ x: e.x - old.x, y: e.y - old.y });
      }
      if (e.lastRelease > old.lastRelease) old.releases++;
      old.lastRelease = e.lastRelease;
      old.x = e.x;
      old.y = e.y;
      old.tick = tick;
      old.dash = !!e.dash;
    }
    for (const p of projectiles) {
      if (this.shots.has(p.id)) continue;
      const source = entities.find((e) => e.id === p.source);
      if (source?.type !== 'friendly.rifle_squad') continue;
      const target = entities.find((e) => e.id === p.target);
      this.shots.set(p.id, {
        heading: source.heading,
        member: this.firingMember(source.id),
        distance: target
          ? Math.max(1024, distance(p.release, target) - target.radius)
          : p.maxTravel,
      });
    }
    for (const id of this.shots.keys())
      if (!projectiles.some((p) => p.id === id)) this.shots.delete(id);
  }
  sample(id: number, alpha = 1): number {
    const pose = this.poses.get(id);
    if (!pose) return 0;
    return Math.floor(
      pose.previous + (pose.phase - pose.previous) * Math.min(1, Math.max(0, alpha)),
    );
  }
  heading(id: number): number | undefined {
    return this.poses.get(id)?.heading;
  }
  firingMember(id: number): number {
    return Math.max(0, (this.poses.get(id)?.releases ?? 1) - 1) % 3;
  }
  projectile(id: number) {
    return this.shots.get(id);
  }
}
