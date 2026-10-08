import { buy, place, validateLayout } from './construction';
import { definition } from './catalog';
import type { GameState, Preset } from './model';
export interface LayoutPreview {
  state: GameState;
  accepted: number;
  rejected: string[];
  cost: number;
}
export function batchPreview(
  s: GameState,
  type: string,
  count: number,
  x: number,
  y: number,
  columns: number,
  rotation: number,
): LayoutPreview {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 40 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 40
  )
    throw new Error('Batch count/columns must be 1–40');
  const d = definition(type),
    w = rotation % 2 ? d.height : d.width,
    h = rotation % 2 ? d.width : d.height;
  let state = structuredClone(s);
  const rejected: string[] = [];
  let accepted = 0;
  for (let i = 0; i < count; i++) {
    const next = structuredClone(state);
    try {
      const a = next.assets.find((a) => a.type === type && !a.placement) ?? buy(next, type);
      place(next, a.id, x + (i % columns) * w, y + Math.floor(i / columns) * h, rotation);
      state = next;
      accepted++;
    } catch (e) {
      rejected.push(`Cell ${i + 1}: ${(e as Error).message}`);
    }
  }
  return { state, accepted, rejected, cost: s.credits - state.credits };
}
export function movePreview(s: GameState, ids: Set<string>, dx: number, dy: number): LayoutPreview {
  if (ids.size > 40 || !Number.isInteger(dx) || !Number.isInteger(dy))
    throw new Error('Move up to 40 assets by whole GU offsets');
  const state = structuredClone(s);
  let accepted = 0;
  const rejected: string[] = [];
  for (const a of state.assets.filter((a) => ids.has(a.id))) {
    if (!a.placement) {
      rejected.push(`${definition(a.type).name}: stored`);
      continue;
    }
    a.placement.x += dx;
    a.placement.y += dy;
    a.tactics.anchor.x += dx;
    a.tactics.anchor.y += dy;
    accepted++;
  }
  const errors = validateLayout(state);
  if (errors.length) throw new Error(`Group move is invalid: ${errors.join('; ')}`);
  return { state, accepted, rejected, cost: 0 };
}
export function presetPreview(s: GameState, p: Preset, partial = false): LayoutPreview {
  let state = structuredClone(s);
  const missing = p.placements.filter((v) => !s.assets.some((a) => a.id === v.id));
  for (const a of state.assets) {
    const v = p.placements.find((v) => v.id === a.id);
    a.placement = v?.placement ?? null;
    if (v) a.tactics = structuredClone(v.tactics);
  }
  const errors = validateLayout(state);
  if (!partial) {
    if (missing.length || errors.length)
      throw new Error(`${missing.length} missing IDs; ${errors.join('; ')}`);
    return {
      state,
      accepted: p.placements.filter((v) => v.placement).length,
      rejected: [],
      cost: 0,
    };
  }
  state = structuredClone(s);
  for (const a of state.assets) a.placement = null;
  const rejected = missing.map((v) => `Missing ${v.id}`);
  let accepted = 0;
  for (const v of p.placements) {
    const next = structuredClone(state),
      a = next.assets.find((a) => a.id === v.id);
    if (!a) continue;
    a.tactics = structuredClone(v.tactics);
    a.placement = structuredClone(v.placement);
    const invalid = validateLayout(next);
    if (invalid.length) rejected.push(`${definition(a.type).name}: ${invalid.join('; ')}`);
    else {
      state = next;
      accepted += Number(!!v.placement);
    }
  }
  return { state, accepted, rejected, cost: 0 };
}
