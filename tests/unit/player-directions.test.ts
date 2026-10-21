import { it, expect } from 'vitest';
import original from '../../src/data/heading.json';
import { direction, TRIG, length, sqrtFloor } from '../../src/sim/fixed';
import { worldHeading, spriteDirection } from '../../src/game/facing';
import { project, type Camera } from '../../src/render/projection';
it('reconstructs all 65,536 original full-circle vectors exactly', () => {
  for (let h = 0; h < 65536; h++) {
    const p = direction(h);
    if (p.x !== original[h]![0] || p.y !== original[h]![1]) throw Error('Heading ' + h);
  }
  expect(direction(-1)).toEqual(direction(65535));
  expect(direction(65536)).toEqual(direction(0));
});
it('aligns source artwork with actual movement in all eight directions and four cameras', () => {
  for (const view of [0, 1, 2, 3] as const)
    for (let h = 0; h < 8; h++) {
      const camera: Camera = { x: 0, y: 0, width: 0, height: 0, zoom: 1, view };
      const heading = worldHeading(h * 45),
        motion = direction(heading),
        screen = project({ x: motion.x / TRIG, y: motion.y / TRIG }, camera),
        frame = spriteDirection(heading, view, 8),
        a = (frame * Math.PI) / 4;
      expect((Math.cos(a) + Math.sin(a)) * 16).toBeCloseTo(screen.x, 4);
      expect((Math.cos(a) - Math.sin(a)) * 8).toBeCloseTo(screen.y, 4);
      if (h % 2 === 0) expect(spriteDirection(heading, view, 4) * 2).toBe(frame);
    }
  expect(worldHeading(0)).toBe(0);
  expect(worldHeading(90)).toBe(16384);
  expect(worldHeading(-90)).toBe(49152);
});
it('optimized lengths match authoritative integer roots across the field and precision boundary', () => {
  const samples = [0, 1, 512, 61440, 100000, 67000000, 100000000];
  for (let i = 0; i < 10000; i++) samples.push(((i * 42731) % 122881) - 61440);
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]!,
      y = samples[(i * 13 + 3) % samples.length]!,
      n = BigInt(x) ** 2n + BigInt(y) ** 2n,
      f = sqrtFloor(n);
    expect(length({ x, y })).toBe(Number(n - f * f >= (f + 1n) * (f + 1n) - n ? f + 1n : f));
  }
});
it('safe integer bearing comparisons preserve the original BigInt decisions', async () => {
  const { bearing, H } = await import('../../src/sim/fixed');
  const originalBearing = (x: number, y: number) => {
    if (!x && !y) return 0;
    const ax = Math.abs(x),
      ay = Math.abs(y);
    let lo = 0,
      hi = 16384;
    while (lo < hi) {
      const m = (lo + hi) >> 1,
        d = original[m]!;
      if (BigInt(ax) * BigInt(-d[1]!) > BigInt(ay) * BigInt(d[0]!)) lo = m + 1;
      else hi = m;
    }
    let a = lo;
    if (a > 0) {
      const p = original[a - 1]!,
        q = original[a]!,
        pc = BigInt(ax) * BigInt(-p[1]!) - BigInt(ay) * BigInt(p[0]!),
        qc = BigInt(ax) * BigInt(-q[1]!) - BigInt(ay) * BigInt(q[0]!);
      if (
        pc * pc * (BigInt(q[0]!) ** 2n + BigInt(q[1]!) ** 2n) <=
        qc * qc * (BigInt(p[0]!) ** 2n + BigInt(p[1]!) ** 2n)
      )
        a--;
    }
    return ((x >= 0 ? (y <= 0 ? a : 32768 - a) : y >= 0 ? 32768 + a : 65536 - a) + H) % H;
  };
  for (let i = 0; i < 5000; i++) {
    const x = ((i * 42731) % 122881) - 61440,
      y = ((i * 17137) % 122881) - 61440;
    expect(bearing({ x, y })).toBe(originalBearing(x, y));
  }
  for (const x of [0, 1, -1, 9000000000])
    for (const y of [0, 1, -1, 9000000000]) expect(bearing({ x, y })).toBe(originalBearing(x, y));
});
