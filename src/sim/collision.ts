import { divRound, productRatio, sqrtFloor, FRACTION, type Vec, distance } from './fixed';
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
        x: t.x + productRatio(p.x - t.x, t.radius, d),
        y: t.y + productRatio(p.y - t.y, t.radius, d),
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
      const t1 = productRatio(min - v, FRACTION, Math.abs(d)) * Math.sign(d),
        t2 = productRatio(max - v, FRACTION, Math.abs(d)) * Math.sign(d);
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return null;
    }
  }
  return lo;
}
/** Boolean equivalent of sweep(..., rectangle, 0). Preserve quantized corner
 * contacts while avoiding two duplicate slabs and four BigInt circle sweeps. */
export function intersectsRectangle(a: Vec, b: Vec, r: Rect): boolean {
  if (rectangle(a, b, r) !== null) return true;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    aa = dx * dx + dy * dy;
  if (!aa) return false;
  for (const x of [r.x, r.x + r.width])
    for (const y of [r.y, r.y + r.height]) {
      const px = x - a.x,
        py = y - a.y,
        cross = px * dy - py * dx,
        dot = px * dx + py * dy;
      if (
        !Number.isSafeInteger(cross) ||
        !Number.isSafeInteger(dot * FRACTION) ||
        !Number.isSafeInteger((FRACTION + 1) * aa)
      ) {
        if (circle(a, b, { x, y }, 0) !== null) return true;
      } else if (cross === 0 && -aa < dot * FRACTION && dot * FRACTION < (FRACTION + 1) * aa)
        return true;
    }
  return false;
}
export function sweep(a: Vec, b: Vec, t: Shape, projectileRadius = 51): number | null {
  // For integer map rays shorter than FRACTION on each axis, one quantum
  // cannot reach across a whole fixed unit outside this conservative box.
  const r = t.rect,
    minX = r ? Math.min(r.x, r.x + r.width) : t.x - t.radius,
    maxX = r ? Math.max(r.x, r.x + r.width) : t.x + t.radius,
    minY = r ? Math.min(r.y, r.y + r.height) : t.y - t.radius,
    maxY = r ? Math.max(r.y, r.y + r.height) : t.y + t.radius;
  if (
    projectileRadius >= 0 &&
    t.radius >= 0 &&
    Math.abs(b.x - a.x) < FRACTION &&
    Math.abs(b.y - a.y) < FRACTION &&
    [a.x, a.y, b.x, b.y, minX, maxX, minY, maxY, projectileRadius].every(Number.isSafeInteger) &&
    (Math.max(a.x, b.x) + projectileRadius < minX ||
      Math.min(a.x, b.x) - projectileRadius > maxX ||
      Math.max(a.y, b.y) + projectileRadius < minY ||
      Math.min(a.y, b.y) - projectileRadius > maxY)
  )
    return null;
  if (!t.rect) return circle(a, b, t, t.radius + projectileRadius);
  const rect = t.rect,
    contacts = [
      rectangle(a, b, {
        x: rect.x - projectileRadius,
        y: rect.y,
        width: rect.width + 2 * projectileRadius,
        height: rect.height,
      }),
      rectangle(a, b, {
        x: rect.x,
        y: rect.y - projectileRadius,
        width: rect.width,
        height: rect.height + 2 * projectileRadius,
      }),
    ];
  for (const x of [rect.x, rect.x + rect.width])
    for (const y of [rect.y, rect.y + rect.height])
      contacts.push(circle(a, b, { x, y }, projectileRadius));
  const actual = contacts.filter((f): f is number => f !== null);
  return actual.length ? Math.min(...actual) : null;
}
export function bodyDamage(raw: number, armor: number, reduction = 0): number {
  return divRound(
    BigInt(raw) * 100n * BigInt(100 - reduction),
    BigInt(100 + Math.max(0, armor)) * 100n,
  );
}
