import { edgeClear, type Rect } from '../construction/geometry';
import { distance, type Vec } from './fixed';
const N = 120,
  COUNT = N * N;
const neighbors = [
  [0, -1, 512],
  [1, -1, 724],
  [1, 0, 512],
  [1, 1, 724],
  [0, 1, 512],
  [-1, 1, 724],
  [-1, 0, 512],
  [-1, -1, 724],
] as const;
export const cellPoint = (i: number): Vec => ({
  x: (i % N) * 512 + 256,
  y: Math.floor(i / N) * 512 + 256,
});
export const cellIndex = (p: Vec): number =>
  Math.max(0, Math.min(N - 1, Math.floor(p.y / 512))) * N +
  Math.max(0, Math.min(N - 1, Math.floor(p.x / 512)));
class Heap {
  data: { i: number; cost: number }[] = [];
  less(a: { i: number; cost: number }, b: { i: number; cost: number }): boolean {
    return a.cost < b.cost || (a.cost === b.cost && a.i < b.i);
  }
  push(v: { i: number; cost: number }): void {
    let i = this.data.length;
    this.data.push(v);
    while (i) {
      const p = (i - 1) >> 1,
        a = this.data[p];
      if (!a || !this.less(v, a)) break;
      this.data[i] = a;
      i = p;
      this.data[i] = v;
    }
  }
  pop(): { i: number; cost: number } | undefined {
    const first = this.data[0],
      last = this.data.pop();
    if (!last || !this.data.length) return first;
    this.data[0] = last;
    let i = 0;
    for (;;) {
      let k = i;
      for (const child of [i * 2 + 1, i * 2 + 2]) {
        const a = this.data[child],
          b = this.data[k];
        if (a && b && this.less(a, b)) k = child;
      }
      if (k === i) break;
      const a = this.data[i],
        b = this.data[k];
      if (!a || !b) throw new Error('Invalid heap');
      this.data[i] = b;
      this.data[k] = a;
      i = k;
    }
    return first;
  }
}
export class Flow {
  readonly costs = new Float64Array(COUNT).fill(Infinity);
  readonly parents = new Int32Array(COUNT).fill(-1);
  readonly legal = new Uint8Array(COUNT);
  readonly edges: number[][] = Array.from({ length: COUNT }, () => []);
  constructor(
    readonly radius: number,
    readonly solids: Rect[],
    readonly goals: (p: Vec) => boolean,
    readonly debris: Rect[] = [],
  ) {
    const heap = new Heap();
    for (let i = 0; i < COUNT; i++) {
      const p = cellPoint(i);
      if (edgeClear(p, p, radius, solids)) {
        this.legal[i] = 1;
        if (goals(p)) {
          this.costs[i] = 0;
          heap.push({ i, cost: 0 });
        }
      }
    }
    // Each undirected edge is tested once, including continuous diagonal clearance.
    for (let i = 0; i < COUNT; i++) {
      if (!this.legal[i]) continue;
      const x = i % N,
        y = Math.floor(i / N),
        a = cellPoint(i);
      for (let order = 0; order < neighbors.length; order++) {
        const v = neighbors[order];
        if (!v) throw new Error('Missing neighbor');
        const xx = x + v[0],
          yy = y + v[1],
          j = yy * N + xx;
        if (xx < 0 || xx >= N || yy < 0 || yy >= N || !this.legal[j]) continue;
        if (j > i) {
          if (edgeClear(a, cellPoint(j), radius, solids)) {
            this.edges[i]?.push(order);
            this.edges[j]?.push((order + 4) % 8);
          }
        }
      }
    }
    for (const e of this.edges) e.sort((a, b) => a - b);
    let entry = heap.pop();
    while (entry) {
      const { i, cost } = entry;
      if (cost === this.costs[i])
        for (const order of this.edges[i] ?? []) {
          const n = neighbors[order];
          if (!n) throw new Error('Missing neighbor');
          const j = i + n[1] * N + n[0],
            p = cellPoint(j),
            slow = this.debris.some(
              (r) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height,
            ),
            next = cost + (slow ? Math.floor((n[2] * 115 + 50) / 100) : n[2]),
            old = this.costs[j];
          if (old === undefined) throw new Error('Missing cost');
          const previous = this.parents[j] ?? -1;
          if (
            next < old ||
            (next === old && this.parentOrder(j, i) < this.parentOrder(j, previous))
          ) {
            this.costs[j] = next;
            this.parents[j] = i;
            if (next < old) heap.push({ i: j, cost: next });
          }
        }
      entry = heap.pop();
    }
  }
  private parentOrder(a: number, b: number): number {
    if (b < 0) return 99;
    const dx = (b % N) - (a % N),
      dy = Math.floor(b / N) - Math.floor(a / N);
    return neighbors.findIndex((n) => n[0] === dx && n[1] === dy);
  }
  waypoint(p: Vec): Vec | null {
    const i = cellIndex(p),
      next = this.parents[i];
    if (!Number.isFinite(this.costs[i])) return null;
    if (distance(p, cellPoint(i)) > 220 && edgeClear(p, cellPoint(i), this.radius, this.solids))
      return cellPoint(i);
    return next !== undefined && next >= 0 ? cellPoint(next) : p;
  }
}
