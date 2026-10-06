// Blueprint §§5, 5A, 24H.1: exact fixed-grid continuous body clearance.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Position {
  x: number;
  y: number;
}
export const CORE: Rect = { x: 28, y: 28, width: 4, height: 4 };
export const PRECINCT: Rect = { x: 27, y: 27, width: 6, height: 6 };
export const PAD: Rect = { x: 29, y: 33, width: 2, height: 2 };
export const ENTRANCES: readonly Position[] = [
  { x: 3, y: 18 },
  { x: 3, y: 42 },
  { x: 18, y: 3 },
  { x: 42, y: 3 },
  { x: 57, y: 30 },
  { x: 30, y: 57 },
];
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function pointDistanceSquared(p: Position, r: Rect): number {
  const x = Math.max(r.x - p.x, 0, p.x - r.x - r.width),
    y = Math.max(r.y - p.y, 0, p.y - r.y - r.height);
  return x * x + y * y;
}
// All inputs are integer fixed-point. BigInt prevents overflow in the interior
// point/segment distance comparison; no irrational distances enter legality.
function nearSegment(p: Position, a: Position, b: Position, radius: number): boolean {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    px = p.x - a.x,
    py = p.y - a.y;
  const length = dx * dx + dy * dy,
    dot = px * dx + py * dy;
  if (dot <= 0) return px * px + py * py < radius * radius;
  if (dot >= length) return (p.x - b.x) ** 2 + (p.y - b.y) ** 2 < radius * radius;
  const cross = BigInt(px * dy - py * dx);
  return cross * cross < BigInt(radius * radius) * BigInt(length);
}
function intersects(a: Position, b: Position, r: Rect): boolean {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.x, r.x + r.width],
    [a.y, b.y - a.y, r.y, r.y + r.height],
  ]) {
    if (start === undefined || delta === undefined || min === undefined || max === undefined)
      throw new Error('Invalid segment');
    if (delta === 0) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return false;
    }
  }
  return true;
}
export function edgeClear(
  a: Position,
  b: Position,
  radius: number,
  solids: readonly Rect[],
): boolean {
  for (const p of [a, b])
    if (p.x < radius || p.y < radius || p.x >= 61440 - radius || p.y >= 61440 - radius)
      return false;
  for (const r of solids) {
    if (
      Math.max(a.x, b.x) + radius <= r.x ||
      Math.min(a.x, b.x) - radius >= r.x + r.width ||
      Math.max(a.y, b.y) + radius <= r.y ||
      Math.min(a.y, b.y) - radius >= r.y + r.height
    )
      continue;
    if (
      pointDistanceSquared(a, r) < radius * radius ||
      pointDistanceSquared(b, r) < radius * radius ||
      intersects(a, b, r)
    )
      return false;
    for (const x of [r.x, r.x + r.width])
      for (const y of [r.y, r.y + r.height]) if (nearSegment({ x, y }, a, b, radius)) return false;
  }
  return true;
}
export function validateRoutes(
  rectangles: readonly Rect[],
  profiles: readonly number[] = [461, 768],
): string | undefined {
  const solids = [CORE, ...rectangles].map((r) => ({
    x: r.x * 1024,
    y: r.y * 1024,
    width: r.width * 1024,
    height: r.height * 1024,
  }));
  const core = solids[0];
  if (!core) throw new Error('Core missing');
  const count = 120,
    size = count * count,
    positions = Array.from({ length: size }, (_, id) => ({
      x: (id % count) * 512 + 256,
      y: Math.floor(id / count) * 512 + 256,
    }));
  for (const radius of profiles) {
    const legal = new Uint8Array(size),
      seen = new Uint8Array(size),
      queue = new Int32Array(size);
    let head = 0,
      tail = 0;
    for (let id = 0; id < size; id++) {
      const p = positions[id];
      if (!p) continue;
      if (edgeClear(p, p, radius, solids)) {
        legal[id] = 1;
        if (pointDistanceSquared(p, core) <= (radius + 512) ** 2) {
          seen[id] = 1;
          queue[tail++] = id;
        }
      }
    }
    while (head < tail) {
      const id = queue[head++];
      if (id === undefined) throw new Error('Queue invalid');
      const x = id % count,
        y = Math.floor(id / count),
        a = positions[id];
      if (!a) throw new Error('Node missing');
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const nx = x + dx,
          ny = y + dy,
          nid = ny * count + nx;
        if (nx < 0 || ny < 0 || nx >= count || ny >= count || !legal[nid] || seen[nid]) continue;
        if (dx && dy && (!legal[y * count + nx] || !legal[ny * count + x])) continue;
        const b = positions[nid];
        if (!b || !edgeClear(a, b, radius, solids)) continue;
        seen[nid] = 1;
        queue[tail++] = nid;
      }
    }
    for (let i = 0; i < ENTRANCES.length; i++) {
      const entrance = ENTRANCES[i];
      if (!entrance) continue;
      const candidates: { id: number; distance: number }[] = [];
      for (let y = (entrance.y - 2) * 2; y < (entrance.y + 2) * 2; y++)
        for (let x = (entrance.x - 2) * 2; x < (entrance.x + 2) * 2; x++) {
          const id = y * count + x,
            p = positions[id];
          if (p && legal[id])
            candidates.push({
              id,
              distance: (p.x - entrance.x * 1024) ** 2 + (p.y - entrance.y * 1024) ** 2,
            });
        }
      candidates.sort((a, b) => a.distance - b.distance || a.id - b.id);
      const spawn = candidates[0];
      if (!spawn || !seen[spawn.id])
        return `Entrance ${i + 1} has no radius ${(radius / 1024).toFixed(3)} GU route to the Core.`;
    }
  }
  return undefined;
}
