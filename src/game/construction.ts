import { analyzeRoutes, overlaps, PRECINCT, PAD, type Rect } from '../construction/geometry';
import { definition } from './catalog';
import { makeAsset, maxHealth, type Asset, type GameState } from './model';
export function footprint(a: Asset): Rect | null {
  if (!a.placement) return null;
  const d = definition(a.type),
    r = a.placement.rotation % 2;
  return {
    x: a.placement.x,
    y: a.placement.y,
    width: r ? d.height : d.width,
    height: r ? d.width : d.height,
  };
}
export function solidAsset(a: Asset, radius = 0.75, ally = false): boolean {
  const d = definition(a.type);
  if (d.category === 'mobile' || d.category === 'warden' || d.category === 'trap') return false;
  if (
    [
      'friendly.low_cover',
      'friendly.razor_field',
      'friendly.resonance_channel',
      'friendly.elevated_firing_platform',
    ].includes(a.type)
  )
    return false;
  if (a.type === 'friendly.anti_vehicle_obstacle') return radius >= 0.6;
  if (a.type === 'friendly.controlled_gate')
    return a.tactics.gate === 'Closed' || (a.tactics.gate === 'Allied passage' && !ally);
  return true;
}
export function landRects(s: GameState): Rect[] {
  const result: Rect[] = [{ x: 12, y: 12, width: 36, height: 36 }];
  const land: Record<string, Rect> = {
    North: { x: 12, y: 6, width: 36, height: 6 },
    East: { x: 48, y: 12, width: 6, height: 36 },
    South: { x: 12, y: 48, width: 36, height: 6 },
    West: { x: 6, y: 12, width: 6, height: 36 },
    NW: { x: 6, y: 6, width: 6, height: 6 },
    NE: { x: 48, y: 6, width: 6, height: 6 },
    SE: { x: 48, y: 48, width: 6, height: 6 },
    SW: { x: 6, y: 48, width: 6, height: 6 },
  };
  for (const id of s.land) {
    const r = land[id];
    if (r) result.push(r);
  }
  return result;
}
export function limits(s: GameState) {
  return {
    capacity: 20 + Math.floor((100 * (s.rank - 1)) / 99),
    barriers: 40 + Math.floor((160 * (s.rank - 1)) / 99),
    traps: 8 + Math.floor((32 * (s.rank - 1)) / 99),
  };
}
export function usage(s: GameState) {
  const active = s.assets.filter((a) => a.placement);
  return {
    capacity: active.reduce((n, a) => n + definition(a.type).capacity, 0),
    barriers: active.reduce(
      (n, a) =>
        n +
        (definition(a.type).category === 'route' && a.type !== 'friendly.elevated_firing_platform'
          ? definition(a.type).width * definition(a.type).height
          : 0),
      0,
    ),
    traps: active.filter((a) => definition(a.type).category === 'trap').length,
    entities: active.filter((a) => !['route', 'trap'].includes(definition(a.type).category)).length,
  };
}
const platformMounts = new Set([
  'friendly.sentry',
  'friendly.rotary',
  'friendly.skyguard',
  'friendly.arc_spire',
  'friendly.nullifier',
]);
export function validateLayout(s: GameState, routes = true): string[] {
  const issues: string[] = [],
    placed = s.assets.filter((a) => a.placement),
    lim = limits(s),
    used = usage(s),
    land = landRects(s);
  if (used.capacity > lim.capacity)
    issues.push(`Command capacity ${used.capacity}/${lim.capacity}`);
  if (used.barriers > lim.barriers) issues.push(`Barrier cells ${used.barriers}/${lim.barriers}`);
  if (used.traps > lim.traps) issues.push(`Traps ${used.traps}/${lim.traps}`);
  if (used.entities > 80) issues.push('80 deployed command entities maximum');
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]!;
    const r = footprint(a)!;
    for (let x = r.x; x < r.x + r.width; x++)
      for (let y = r.y; y < r.y + r.height; y++)
        if (!land.some((l) => x >= l.x && x < l.x + l.width && y >= l.y && y < l.y + l.height)) {
          issues.push(`${definition(a.type).name}: outside owned land`);
          x = r.x + r.width;
          break;
        }
    if (overlaps(r, PRECINCT)) issues.push(`${definition(a.type).name}: Core precinct is reserved`);
    if (
      overlaps(r, PAD) &&
      !(a.type === s.warden && r.x === PAD.x && r.y === PAD.y && r.width === 2 && r.height === 2)
    )
      issues.push('Warden pad is reserved');
    if (definition(a.type).category === 'warden' && a.type !== s.warden)
      issues.push('Only the selected Warden may deploy');
    for (let j = 0; j < i; j++) {
      const b = placed[j]!,
        q = footprint(b)!;
      if (!overlaps(r, q)) continue;
      const mount =
        ((a.type === 'friendly.elevated_firing_platform' && platformMounts.has(b.type)) ||
          (b.type === 'friendly.elevated_firing_platform' && platformMounts.has(a.type))) &&
        r.x === q.x &&
        r.y === q.y &&
        r.width === q.width &&
        r.height === q.height;
      if (!mount) issues.push(`${definition(a.type).name} overlaps ${definition(b.type).name}`);
    }
  }
  if (routes && !issues.length && s.rank < 25) {
    const rects = placed.filter((a) => solidAsset(a, 1.2)).map((a) => footprint(a)!);
    const route = analyzeRoutes(rects, [768, 1229]);
    if (route.traces.some((t) => !t.valid))
      issues.push('Keep all six entrances open for heavy and boss clearance until Rank 25');
  }
  return [...new Set(issues)];
}
export function place(s: GameState, id: string, x: number, y: number, rotation = 0): void {
  const a = s.assets.find((a) => a.id === id);
  if (!a) throw new Error('Asset missing');
  const old = a.placement;
  a.placement = { x, y, rotation };
  const errors = validateLayout(s);
  if (errors.length) {
    a.placement = old;
    throw new Error(errors[0]);
  }
  a.tactics.anchor = {
    x: x + Math.floor(definition(a.type).width / 2),
    y: y + Math.floor(definition(a.type).height / 2),
  };
}
export function guidedLayout(s: GameState): void {
  const next = structuredClone(s);
  for (const a of next.assets) a.placement = null;
  const counters: Record<string, number> = {};
  for (const a of next.assets) {
    const d = definition(a.type);
    if (d.category === 'warden') {
      if (a.type === next.warden) a.placement = { x: 29, y: 33, rotation: 0 };
      continue;
    }
    const n = counters[d.category] ?? 0;
    counters[d.category] = n + 1;
    const pos =
      d.category === 'tower'
        ? { x: 22, y: 24 + n * 6 }
        : d.category === 'mobile'
          ? { x: 25, y: 25 + n * 5 }
          : ['support', 'infrastructure'].includes(d.category)
            ? { x: 25, y: 35 + n * 3 }
            : d.category === 'trap'
              ? { x: 20, y: 26 + n * 4 }
              : d.category === 'route'
                ? { x: 17 + Math.floor(n / 4) * 2, y: 20 + (n % 4) * 3 }
                : null;
    if (pos && pos.y + d.height <= 46) {
      a.placement = { ...pos, rotation: 0 };
      a.tactics.anchor = { x: pos.x + 1, y: pos.y + 1 };
    }
  }
  const errors = validateLayout(next);
  if (errors.length) throw new Error(errors.join('; '));
  s.assets = next.assets;
}
export function buy(s: GameState, type: string): Asset {
  const d = definition(type);
  if (d.rank > s.rank) throw new Error(`Unlocks at Rank ${d.rank}`);
  if (s.assets.length >= 1024) throw new Error('Owned inventory is full');
  if (d.category === 'warden') throw new Error('Acquire Wardens through the Warden menu');
  if (s.credits < d.cost) throw new Error('Not enough Credits');
  const a = makeAsset(type);
  s.credits -= d.cost;
  s.assets.push(a);
  return a;
}
export const LAND_OFFERS = [
  ['North', 15, 2000],
  ['East', 40, 6000],
  ['South', 60, 12000],
  ['West', 80, 20000],
  ['NW', 85, 8000],
  ['NE', 88, 8000],
  ['SE', 92, 8000],
  ['SW', 95, 8000],
] as const;
export function expandLand(s: GameState, id: string): void {
  const offer = LAND_OFFERS.find((o) => o[0] === id);
  if (!offer || s.land.includes(id)) throw new Error('Land unavailable');
  if (s.rank < offer[1] || s.credits < offer[2])
    throw new Error(`Requires Rank ${offer[1]} and ${offer[2]} Credits`);
  const adjacent: Record<string, string[]> = {
    NW: ['North', 'West'],
    NE: ['North', 'East'],
    SE: ['South', 'East'],
    SW: ['South', 'West'],
  };
  if ((adjacent[id] ?? []).some((v) => !s.land.includes(v)))
    throw new Error('Acquire both adjoining strips first');
  s.credits -= offer[2];
  s.land.push(id);
}
export function upgradeWall(s: GameState, id: string): void {
  const a = s.assets.find((a) => a.id === id);
  if (!a || a.type !== 'friendly.standard_barricade' || s.rank < 25 || s.credits < 80)
    throw new Error('Wall upgrade requires Rank 25 and 80 Credits');
  const old = maxHealth(a);
  a.type = 'friendly.reinforced_wall';
  a.hp = a.hp ? Math.min(maxHealth(a), a.hp + maxHealth(a) - old) : 0;
  a.basePaid += 80;
  s.credits -= 80;
}
