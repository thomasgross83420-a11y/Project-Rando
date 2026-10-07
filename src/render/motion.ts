import { combat } from '../data/combat';
import type { Entity } from '../sim/battle';
import { distance } from '../sim/fixed';

interface PoseMotion {
  x: number;
  y: number;
  tick: number;
  phase: number;
  previous: number;
  dash: boolean;
}

/** Observe every authoritative step. Presentation cadence never reads wall time.
 * Nominal motion retains the authored 10fps cadence; slower/blocked motion slows
 * or freezes the gait. A dash uses its ability pose and never drives walk phase.
 */
export class MotionTracker {
  private readonly poses = new Map<number, PoseMotion>();
  observe(entities: readonly Entity[], tick: number): void {
    for (const e of entities) {
      const d = combat[e.type];
      if (!d.radius) continue;
      const old = this.poses.get(e.id);
      if (!old || tick < old.tick) {
        this.poses.set(e.id, { x: e.x, y: e.y, tick, phase: 0, previous: 0, dash: !!e.dash });
        continue;
      }
      if (tick === old.tick) continue;
      old.previous = old.phase;
      const moved = distance(e, old);
      if (e.hp > 0 && !e.dash && !old.dash && !e.cast && e.lastMove === tick && d.speed > 0)
        old.phase += (moved * 60) / d.speed;
      old.x = e.x;
      old.y = e.y;
      old.tick = tick;
      old.dash = !!e.dash;
    }
  }
  sample(id: number, alpha = 1): number {
    const pose = this.poses.get(id);
    if (!pose) return 0;
    return Math.floor(
      pose.previous + (pose.phase - pose.previous) * Math.min(1, Math.max(0, alpha)),
    );
  }
}
