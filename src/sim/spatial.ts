import { U, type Vec } from './fixed';
import type { Shape } from './collision';
interface Indexed extends Shape {
  id: number;
  hp: number;
}
/** Derived ground collision broad phase. Pinned 2 GU cells, stable ID queries. */
export class SpatialIndex<T extends Indexed> {
  private cells = new Map<string, Set<T>>();
  private memberships = new Map<number, string[]>();
  private keys(minX: number, minY: number, maxX: number, maxY: number): string[] {
    const result = [];
    for (let y = Math.floor(minY / (2 * U)); y <= Math.floor(maxY / (2 * U)); y++)
      for (let x = Math.floor(minX / (2 * U)); x <= Math.floor(maxX / (2 * U)); x++)
        result.push(`${x},${y}`);
    return result;
  }
  rebuild(entities: readonly T[]): void {
    this.cells.clear();
    this.memberships.clear();
    for (const e of entities) if (e.hp > 0) this.update(e);
  }
  update(e: T): void {
    for (const key of this.memberships.get(e.id) ?? []) {
      const cell = this.cells.get(key);
      cell?.delete(e);
      if (!cell?.size) this.cells.delete(key);
    }
    this.memberships.delete(e.id);
    if (e.hp <= 0) return;
    const r = e.rect,
      keys = this.keys(
        r?.x ?? e.x - e.radius,
        r?.y ?? e.y - e.radius,
        r ? r.x + r.width : e.x + e.radius,
        r ? r.y + r.height : e.y + e.radius,
      );
    this.memberships.set(e.id, keys);
    for (const key of keys) {
      const cell = this.cells.get(key) ?? new Set<T>();
      cell.add(e);
      this.cells.set(key, cell);
    }
  }
  query(a: Vec, b = a, radius = 0): T[] {
    const found = new Map<number, T>();
    for (const key of this.keys(
      Math.min(a.x, b.x) - radius,
      Math.min(a.y, b.y) - radius,
      Math.max(a.x, b.x) + radius,
      Math.max(a.y, b.y) + radius,
    ))
      for (const e of this.cells.get(key) ?? []) if (e.hp > 0) found.set(e.id, e);
    return [...found.values()].sort((a, b) => a.id - b.id);
  }
}
