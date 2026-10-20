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
const NEIGHBORS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;
const clearanceCache = new Map<string, { legal: Int8Array; edges: Int8Array }>();
function clearance(radius: number, solids: Rect[]) {
  const key = radius + '|' + solids.map((r) => `${r.x},${r.y},${r.width},${r.height}`).join('|');
  let grid = clearanceCache.get(key);
  if (!grid) {
    grid = { legal: new Int8Array(COUNT).fill(-1), edges: new Int8Array(COUNT * 8).fill(-1) };
    clearanceCache.set(key, grid);
    if (clearanceCache.size > 8) clearanceCache.delete(clearanceCache.keys().next().value!);
  }
  return grid;
}
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
    grid = clearance(radius, solids),
    legal = grid.legal;
  g[first] = 0;
  open.push({ i: first, f: distance(start, goal) });
  let best = first,
    bestD = distance(start, goal),
    reachedGoal = false;
  for (let visited = 0; open.data.length && visited < COUNT; visited++) {
    const current = open.pop()!;
    if (closed[current.i]) continue;
    closed[current.i] = 1;
    const a = current.i === first ? start : point(current.i),
      d = distance(a, goal);
    if (d < bestD) {
      bestD = d;
      best = current.i;
    }
    if (d <= within) {
      best = current.i;
      break;
    }
    // Grid centers rarely coincide with an exact moving goal. Connect to the
    // real goal once visible instead of exhausting the field for a nonexistent
    // center inside a small arrival tolerance.
    if (current.i !== first && edgeClear(a, goal, radius, solids)) {
      best = current.i;
      reachedGoal = true;
      break;
    }
    const x = current.i % N,
      y = Math.floor(current.i / N);
    for (let dir = 0; dir < NEIGHBORS.length; dir++) {
      const [dx, dy] = NEIGHBORS[dir]!;
      const xx = x + dx!,
        yy = y + dy!;
      if (xx < 0 || xx >= N || yy < 0 || yy >= N) continue;
      const i = yy * N + xx;
      if (closed[i]) continue;
      const b = point(i);
      if (legal[i] === -1) legal[i] = Number(edgeClear(b, b, radius, solids));
      if (!legal[i]) continue;
      const edgeIndex = current.i * 8 + dir;
      if (current.i === first) {
        if (!edgeClear(a, b, radius, solids)) continue;
      } else {
        if (grid.edges[edgeIndex] === -1) {
          const value = Number(edgeClear(a, b, radius, solids));
          grid.edges[edgeIndex] = value;
          grid.edges[i * 8 + ((dir + 4) % 8)] = value;
        }
        if (!grid.edges[edgeIndex]) continue;
      }
      const next = g[current.i]! + Math.round(((dx && dy ? 724 : 512) * costAt(b)) / 1000);
      if (next >= g[i]!) continue;
      g[i] = next;
      parents[i] = current.i;
      open.push({ i, f: next + distance(b, goal) });
    }
  }
  if (best === first) return [];
  const nodes: Vec[] = [];
  for (let i = best; i !== first && i >= 0; i = parents[i]!) nodes.push(point(i));
  nodes.reverse();
  if (reachedGoal) nodes.push(goal);
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
