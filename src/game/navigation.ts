/** Bounded half-cell A* for full-runtime moving goals. It never grants a teleport:
 * every chosen path edge and every subsequent physical step uses exact clearance. */
import { edgeClear, type Rect } from '../construction/geometry';
import { distance, type Vec } from '../sim/fixed';
const N = 120,
  COUNT = N * N;
const point = (i: number): Vec => ({ x: (i % N) * 512 + 256, y: Math.floor(i / N) * 512 + 256 });
const index = (p: Vec) =>
  Math.max(0, Math.min(119, Math.floor(p.y / 512))) * N +
  Math.max(0, Math.min(119, Math.floor(p.x / 512)));
class Heap {
  data: { i: number; f: number }[] = [];
  push(v: { i: number; f: number }) {
    let i = this.data.length;
    this.data.push(v);
    while (i) {
      const p = (i - 1) >> 1,
        a = this.data[p]!;
      if (a.f < v.f || (a.f === v.f && a.i < v.i)) break;
      this.data[i] = a;
      i = p;
      this.data[i] = v;
    }
  }
  pop() {
    const first = this.data[0],
      last = this.data.pop();
    if (!last || !this.data.length) return first;
    this.data[0] = last;
    let i = 0;
    for (;;) {
      let k = i;
      for (const j of [i * 2 + 1, i * 2 + 2]) {
        const a = this.data[j],
          b = this.data[k]!;
        if (a && (a.f < b.f || (a.f === b.f && a.i < b.i))) k = j;
      }
      if (k === i) break;
      [this.data[i], this.data[k]] = [this.data[k]!, this.data[i]!];
      i = k;
    }
    return first;
  }
}
export function findPath(
  start: Vec,
  goal: Vec,
  radius: number,
  solids: Rect[],
  within = 256,
  costAt: (p: Vec) => number = () => 1000,
): Vec[] {
  if (distance(start, goal) <= within) return [];
  if (edgeClear(start, goal, radius, solids)) return [goal];
  const first = index(start),
    open = new Heap(),
    g = new Float64Array(COUNT).fill(Infinity),
    parents = new Int32Array(COUNT).fill(-1),
    closed = new Uint8Array(COUNT),
    legal = new Int8Array(COUNT).fill(-1);
  g[first] = 0;
  open.push({ i: first, f: distance(start, goal) });
  let best = first,
    bestD = distance(start, goal);
  for (let visited = 0; open.data.length && visited < COUNT; visited++) {
    const current = open.pop()!;
    if (closed[current.i]) continue;
    closed[current.i] = 1;
    const a = point(current.i),
      d = distance(a, goal);
    if (d < bestD) {
      bestD = d;
      best = current.i;
    }
    if (d <= within) {
      best = current.i;
      break;
    }
    const x = current.i % N,
      y = Math.floor(current.i / N);
    for (const [dx, dy] of [
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
    ]) {
      const xx = x + dx!,
        yy = y + dy!;
      if (xx < 0 || xx >= N || yy < 0 || yy >= N) continue;
      const i = yy * N + xx;
      if (closed[i]) continue;
      const b = point(i);
      if (legal[i] === -1) legal[i] = Number(edgeClear(b, b, radius, solids));
      if (!legal[i] || !edgeClear(a, b, radius, solids)) continue;
      const next = g[current.i]! + Math.round(((dx && dy ? 724 : 512) * costAt(b)) / 1000);
      if (next >= g[i]!) continue;
      g[i] = next;
      parents[i] = current.i;
      open.push({ i, f: next + d });
    }
  }
  if (best === first) return [];
  const nodes: Vec[] = [];
  for (let i = best; i !== first && i >= 0; i = parents[i]!) nodes.push(point(i));
  nodes.reverse();
  if (nodes.length && !edgeClear(start, nodes[0]!, radius, solids)) return [];
  const path: Vec[] = [];
  let from = start;
  for (let i = 0; i < nodes.length; ) {
    let next = i;
    while (next + 1 < nodes.length && edgeClear(from, nodes[next + 1]!, radius, solids)) next++;
    path.push(nodes[next]!);
    from = nodes[next]!;
    i = next + 1;
  }
  return path;
}
