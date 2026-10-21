import { edgeClear, type Rect } from '../construction/geometry';
import { distance, type Vec } from '../sim/fixed';
import { definition } from './catalog';
import { footprint, solidAsset } from './construction';
import { findPath } from './navigation';
import type { GameState, Asset } from './model';
/** Preparation-only validation shared by touch and precise coordinate controls. */
export function validateRallyPoint(s: GameState, a: Asset, point: Vec): void {
  if (
    !Number.isInteger(point.x) ||
    !Number.isInteger(point.y) ||
    point.x < 0 ||
    point.x > 59 ||
    point.y < 0 ||
    point.y > 59
  )
    throw Error('Choose a ground point inside the field.');
  const d = definition(a.type);
  if (!d.speed) return;
  const goal = { x: point.x * 1024, y: point.y * 1024 },
    radius = Math.round(d.radius * 1024),
    solids: Rect[] =
      d.layer === 'air'
        ? []
        : [
            { x: 28672, y: 28672, width: 4096, height: 4096 },
            ...s.assets
              .filter((v) => v.id !== a.id && v.placement && v.hp && solidAsset(v, d.radius, true))
              .map((v) => {
                const r = footprint(v)!;
                return {
                  x: r.x * 1024,
                  y: r.y * 1024,
                  width: r.width * 1024,
                  height: r.height * 1024,
                };
              }),
          ];
  if (
    goal.x < radius ||
    goal.y < radius ||
    goal.x > 61440 - radius ||
    goal.y > 61440 - radius ||
    !edgeClear(goal, goal, radius, solids)
  )
    throw Error('That rally point is blocked. Choose clear ground.');
  if (a.placement) {
    const r = footprint(a)!,
      start = {
        x: Math.round((r.x + r.width / 2) * 1024),
        y: Math.round((r.y + r.height / 2) * 1024),
      };
    if (distance(start, goal) > 512) {
      const path = findPath(start, goal, radius, solids, 512);
      if (!path.length || distance(path.at(-1)!, goal) > 512)
        throw Error('No clear route reaches that rally point.');
    }
  }
}
