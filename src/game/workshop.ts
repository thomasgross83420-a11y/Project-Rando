import type { GameState } from './model';
export const COSMETICS = [
  { id: 'COS01', name: 'Steel Deck', kind: 'ground', cost: 5000, rank: 40 },
  { id: 'COS02', name: 'Dark Crystal', kind: 'ground', cost: 7000, rank: 60 },
  { id: 'COS03', name: 'Rootstone', kind: 'ground', cost: 9000, rank: 80 },
  { id: 'COS04', name: 'Tall Standard', kind: 'banner', cost: 4000, rank: 25 },
  { id: 'COS05', name: 'Twin Standard', kind: 'banner', cost: 6000, rank: 50 },
  { id: 'COS06', name: 'Memorial Plaque', kind: 'plaque', cost: 8000, rank: 1, ending: true },
  { id: 'COS07', name: 'Etched Silver', kind: 'trim', cost: 6000, rank: 50 },
  { id: 'COS08', name: 'Amber Metal', kind: 'trim', cost: 6000, rank: 50 },
  { id: 'COS09', name: 'Violet Alloy', kind: 'trim', cost: 6000, rank: 50 },
  { id: 'COS10', name: 'Bronze Frame', kind: 'hud', cost: 10000, rank: 75 },
  { id: 'COS11', name: 'Slate Frame', kind: 'hud', cost: 10000, rank: 75 },
  { id: 'COS12', name: 'Bastion Laurels', kind: 'plaque', cost: 20000, rank: 100, ending: true },
] as const;
export function purchaseCosmetic(s: GameState, id: string) {
  const c = COSMETICS.find((c) => c.id === id);
  if (!c) throw new Error('Unknown cosmetic');
  if (s.cosmetics.includes(id)) throw new Error('Already owned');
  if (s.rank < c.rank || ('ending' in c && s.stages.length !== 40))
    throw new Error('Cosmetic is progression locked');
  if (s.credits < c.cost) throw new Error(`Requires ${c.cost} Credits`);
  s.credits -= c.cost;
  s.cosmetics.push(id);
}
export function equipCosmetic(s: GameState, id: string) {
  const c = COSMETICS.find((c) => c.id === id);
  if (!c || !s.cosmetics.includes(id)) throw new Error('Purchase this appearance first');
  s.appearance[c.kind] = id;
}
