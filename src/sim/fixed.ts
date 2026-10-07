import headings from '../data/heading.json';
export const U = 1024,
  H = 65536,
  TRIG = 1048576,
  FRACTION = 1048576;
export interface Vec {
  x: number;
  y: number;
}
export function divRound(n: bigint, d: bigint): number {
  if (d <= 0n) throw new Error('Invalid divisor');
  const sign = n < 0n ? -1n : 1n,
    a = n * sign;
  const out = sign * ((2n * a + d) / (2n * d));
  if (out > BigInt(Number.MAX_SAFE_INTEGER) || out < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('Fixed-point overflow');
  return Number(out);
}
export function sqrtFloor(n: bigint): bigint {
  if (n < 0n) throw new Error('Negative length');
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) / 2n;
    if (y >= x) return x;
    x = y;
  }
}
export function length(v: Vec): number {
  const n = BigInt(v.x) ** 2n + BigInt(v.y) ** 2n,
    f = sqrtFloor(n);
  return Number(n - f * f >= (f + 1n) * (f + 1n) - n ? f + 1n : f);
}
export const delta = (a: Vec, b: Vec): Vec => ({ x: b.x - a.x, y: b.y - a.y });
export const distance = (a: Vec, b: Vec): number => length(delta(a, b));
export function direction(h: number, magnitude = TRIG): Vec {
  const v = headings[((h % H) + H) % H];
  if (!v || v[0] === undefined || v[1] === undefined) throw new Error('Missing pinned heading');
  return {
    x: divRound(BigInt(v[0]) * BigInt(magnitude), BigInt(TRIG)),
    y: divRound(BigInt(v[1]) * BigInt(magnitude), BigInt(TRIG)),
  };
}
export function bearing(v: Vec): number {
  if (!v.x && !v.y) return 0;
  const x = Math.abs(v.x),
    y = Math.abs(v.y);
  let lo = 0,
    hi = 16384;
  while (lo < hi) {
    const m = (lo + hi) >> 1,
      d = direction(m);
    if (BigInt(x) * BigInt(-d.y) > BigInt(y) * BigInt(d.x)) lo = m + 1;
    else hi = m;
  }
  let a = lo;
  if (a > 0) {
    const p = direction(a - 1),
      q = direction(a);
    const pc = BigInt(x) * BigInt(-p.y) - BigInt(y) * BigInt(p.x);
    const qc = BigInt(x) * BigInt(-q.y) - BigInt(y) * BigInt(q.x);
    if (
      pc * pc * (BigInt(q.x) ** 2n + BigInt(q.y) ** 2n) <=
      qc * qc * (BigInt(p.x) ** 2n + BigInt(p.y) ** 2n)
    )
      a--;
  }
  return ((v.x >= 0 ? (v.y <= 0 ? a : 32768 - a) : v.y >= 0 ? 32768 + a : 65536 - a) + H) % H;
}
export const angleError = (a: number, b: number): number => Math.abs(((b - a + 98304) % H) - 32768);
export function turn(a: number, b: number, limit: number): number {
  const d = ((b - a + 98304) % H) - 32768;
  return (a + Math.max(-limit, Math.min(limit, d)) + H) % H;
}
