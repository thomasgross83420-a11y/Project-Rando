import { divRound, sqrtFloor, FRACTION, type Vec, distance } from './fixed';
import type { Rect } from '../construction/geometry';
export interface Shape extends Vec {
  radius: number;
  rect: Rect | null;
}
export function boundary(p: Vec, t: Shape): number {
  if (t.rect) {
    const r = t.rect;
    return distance(p, {
      x: Math.max(r.x, Math.min(r.x + r.width, p.x)),
      y: Math.max(r.y, Math.min(r.y + r.height, p.y)),
    });
  }
  return Math.max(0, distance(p, t) - t.radius);
}
export function nearest(p: Vec, t: Shape): Vec {
  if (t.rect) {
    const r = t.rect;
    return {
      x: Math.max(r.x, Math.min(r.x + r.width, p.x)),
      y: Math.max(r.y, Math.min(r.y + r.height, p.y)),
    };
  }
  const d = distance(p, t);
  return d
    ? {
        x: t.x + divRound(BigInt(p.x - t.x) * BigInt(t.radius), BigInt(d)),
        y: t.y + divRound(BigInt(p.y - t.y) * BigInt(t.radius), BigInt(d)),
      }
    : { x: t.x, y: t.y };
}
function circle(a: Vec, b: Vec, c: Vec, r: number): number | null {
  const dx = BigInt(b.x - a.x),
    dy = BigInt(b.y - a.y),
    px = BigInt(a.x - c.x),
    py = BigInt(a.y - c.y),
    aa = dx * dx + dy * dy,
    bb = 2n * (px * dx + py * dy),
    cc = px * px + py * py - BigInt(r) * BigInt(r);
  if (cc <= 0n) return 0;
  if (aa === 0n) return null;
  const disc = bb * bb - 4n * aa * cc;
  if (disc < 0n) return null;
  const t = (-bb * BigInt(FRACTION) - sqrtFloor(disc * BigInt(FRACTION) ** 2n)) / (2n * aa);
  return t >= 0n && t <= BigInt(FRACTION) ? Number(t) : null;
}
function rectangle(a: Vec, b: Vec, r: Rect): number | null {
  let lo = 0,
    hi = FRACTION;
  for (const [v, d, min, max] of [
    [a.x, b.x - a.x, r.x, r.x + r.width],
    [a.y, b.y - a.y, r.y, r.y + r.height],
  ]) {
    if (v === undefined || d === undefined || min === undefined || max === undefined)
      throw new Error('Invalid slab');
    if (!d) {
      if (v < min || v > max) return null;
    } else {
      const t1 = divRound(BigInt(min - v) * BigInt(FRACTION), BigInt(Math.abs(d))) * Math.sign(d),
        t2 = divRound(BigInt(max - v) * BigInt(FRACTION), BigInt(Math.abs(d))) * Math.sign(d);
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return null;
    }
  }
  return lo;
}
export function sweep(a: Vec, b: Vec, t: Shape, projectileRadius = 51): number | null {
  if (!t.rect) return circle(a, b, t, t.radius + projectileRadius);
  const r = t.rect,
    contacts = [
      rectangle(a, b, {
        x: r.x - projectileRadius,
        y: r.y,
        width: r.width + 2 * projectileRadius,
        height: r.height,
      }),
      rectangle(a, b, {
        x: r.x,
        y: r.y - projectileRadius,
        width: r.width,
        height: r.height + 2 * projectileRadius,
      }),
    ];
  for (const x of [r.x, r.x + r.width])
    for (const y of [r.y, r.y + r.height]) contacts.push(circle(a, b, { x, y }, projectileRadius));
  const actual = contacts.filter((f): f is number => f !== null);
  return actual.length ? Math.min(...actual) : null;
}
export function bodyDamage(raw: number, armor: number, reduction = 0): number {
  return divRound(
    BigInt(raw) * 100n * BigInt(100 - reduction),
    BigInt(100 + Math.max(0, armor)) * 100n,
  );
}
