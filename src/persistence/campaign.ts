import { z } from 'zod';
import versions from '../../docs/versions.json';
import {
  contentID,
  doctrines,
  foundation,
  constructionTypes,
  coreBaseline,
  type ContentID,
} from '../data/foundation';
import { CORE, PAD, PRECINCT, overlaps, validateRoutes, type Rect } from '../construction/geometry';
const placement = z
  .object({
    x: z.number().int().min(0).max(59),
    y: z.number().int().min(0).max(59),
    rotation: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();
export const ownedSchema = z
  .object({
    id: z.uuid().transform((id) => id.toLowerCase()),
    type: contentID,
    hp: z.number().int().min(0),
    xp: z.literal(0),
    level: z.literal(1),
    enhancement: z.literal(0),
    stars: z.literal(1),
    paidCredits: z.number().int().min(0),
    placement: placement.nullable(),
  })
  .strict();
export const campaignSchema = z
  .object({
    schema: z.literal(1),
    build: z.literal('0.1.0-foundation'),
    contentVersion: z.literal('rb-content-v1'),
    simulationVersion: z.enum(['rb-sim-v1', 'rb-sim-v2']),
    generatorVersion: z.literal('rb-generator-v1'),
    economyPolicyVersion: z.literal('economy.duration_wave_v1'),
    lineage: z.uuid().transform((id) => id.toLowerCase()),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    name: z
      .string()
      .trim()
      .refine(
        (n) => Array.from(n).length >= 1 && Array.from(n).length <= 32 && !/[\p{Cc}]/u.test(n),
        'Use 1–32 characters without control characters',
      ),
    slot: z.number().int().min(0).max(2),
    doctrine: z.enum(['Bastion', 'Mobile', 'Chokepoint']),
    warden: z.enum(['warden.bulwark', 'warden.ranger', 'warden.conductor']),
    rank: z.literal(1),
    accountXP: z.literal(0),
    credits: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    promotionCores: z.literal(0),
    coreHP: z.literal(coreBaseline.hp * 1024),
    assets: z.array(ownedSchema).max(1024),
  })
  .strict();
export type Campaign = z.infer<typeof campaignSchema>;
export type Owned = z.infer<typeof ownedSchema>;
export function newAsset(type: ContentID, paidCredits = 0): Owned {
  return {
    id: crypto.randomUUID(),
    type,
    hp: foundation[type].hp * 1024,
    xp: 0,
    level: 1,
    enhancement: 0,
    stars: 1,
    paidCredits,
    placement: null,
  };
}
export function createCampaign(
  name: string,
  slot: number,
  doctrine: Campaign['doctrine'],
  warden: Campaign['warden'],
): Campaign {
  if (/[\p{Cc}]/u.test(name)) throw new Error('Campaign name contains a control character');
  const assets: Owned[] = [newAsset(warden)];
  for (const [type, count] of doctrines[doctrine])
    for (let i = 0; i < count; i++) assets.push(newAsset(type));
  return campaignSchema.parse({
    schema: 1,
    build: versions.build,
    contentVersion: versions.content,
    simulationVersion: versions.simulation,
    generatorVersion: versions.generator,
    economyPolicyVersion: versions.economyPolicy,
    lineage: crypto.randomUUID(),
    revision: 0,
    name: name.trim(),
    slot,
    doctrine,
    warden,
    rank: 1,
    accountXP: 0,
    credits: 600,
    promotionCores: 0,
    coreHP: coreBaseline.hp * 1024,
    assets,
  });
}
export function footprint(asset: Owned): Rect | undefined {
  const p = asset.placement;
  if (!p) return;
  const d = foundation[asset.type];
  return {
    x: p.x,
    y: p.y,
    width: p.rotation % 2 ? d.height : d.width,
    height: p.rotation % 2 ? d.width : d.height,
  };
}
export function accounting(c: Campaign): {
  capacity: number;
  barriers: number;
  traps: number;
  entities: number;
} {
  let capacity = 0,
    barriers = 0,
    traps = 0,
    entities = 0;
  for (const a of c.assets)
    if (a.placement) {
      const d = foundation[a.type];
      capacity += d.capacity;
      entities++;
      if (d.category === 'barrier') barriers += d.width * d.height;
      if (d.category === 'trap') traps++;
    }
  return { capacity, barriers, traps, entities };
}
export function validateCampaign(input: unknown): Campaign {
  const c = campaignSchema.parse(input),
    ids = new Set<string>(),
    wardens = new Set<ContentID>(),
    occupied: Rect[] = [],
    solids: Rect[] = [];
  for (const a of c.assets) {
    if (ids.has(a.id)) throw new Error('Duplicate owned identity');
    ids.add(a.id);
    const d = foundation[a.type];
    if (a.hp > d.hp * 1024) throw new Error('Durability exceeds baseline');
    if (a.paidCredits !== 0 && a.paidCredits !== d.cost)
      throw new Error('Unsupported foundation investment ledger');
    if (d.category === 'warden') {
      if (wardens.has(a.type)) throw new Error('Duplicate Warden');
      wardens.add(a.type);
    }
    const r = footprint(a);
    if (!r) continue;
    if (!constructionTypes.includes(a.type))
      throw new Error('Deployment is not implemented for this type in this foundation build');
    if (a.hp === 0)
      throw new Error('Campaign wreck restoration remains Gate3; no zero-health deployment');
    if (d.category === 'warden') {
      if (a.type !== c.warden) throw new Error('Only the selected Warden may deploy');
    }
    if (!(d.category === 'warden' && r.x === PAD.x && r.y === PAD.y)) {
      if (r.x < 12 || r.y < 12 || r.x + r.width > 48 || r.y + r.height > 48)
        throw new Error('Footprint must fit purchased land [12,48)');
      if (overlaps(r, PRECINCT) || overlaps(r, PAD))
        throw new Error('Core precinct and Warden pad are reserved');
    }
    if (occupied.some((o) => overlaps(o, r)))
      throw new Error('Footprint overlaps an owned deployment');
    occupied.push(r);
    if (d.solid) solids.push(r);
  }
  if (!wardens.has(c.warden)) throw new Error('Selected Warden ownership missing');
  const totals = accounting(c);
  if (totals.capacity > 20) throw new Error('Rank 1 capacity limit is 20');
  if (totals.barriers > 40) throw new Error('Rank 1 barrier allowance is 40 cells');
  if (totals.traps > 8) throw new Error('Rank 1 trap allowance is 8');
  if (totals.entities > 80) throw new Error('Deployed entity limit is 80');
  const route = validateRoutes(solids);
  if (route) throw new Error(route);
  return c;
}
export type PreparationCommand =
  | { kind: 'place'; id: string; x: number; y: number; rotation: 0 | 1 | 2 | 3 }
  | { kind: 'store'; id: string }
  | { kind: 'buy-place'; type: ContentID; x: number; y: number; rotation: 0 | 1 | 2 | 3 };
export function applyCommand(before: Campaign, command: PreparationCommand): Campaign {
  const c = structuredClone(before);
  if (command.kind === 'buy-place') {
    const d = foundation[command.type];
    if (d.rank > c.rank || d.category === 'warden') throw new Error('Purchase not unlocked');
    if (c.credits < d.cost) throw new Error('Insufficient Credits');
    c.credits -= d.cost;
    const a = newAsset(command.type, d.cost);
    a.placement = { x: command.x, y: command.y, rotation: command.rotation };
    c.assets.push(a);
  } else {
    const a = c.assets.find((a) => a.id === command.id);
    if (!a) throw new Error('Owned asset missing');
    a.placement =
      command.kind === 'store' ? null : { x: command.x, y: command.y, rotation: command.rotation };
  }
  c.revision++;
  return validateCampaign(c);
}
export function solidFootprints(c: Campaign): Rect[] {
  return c.assets
    .filter((a) => foundation[a.type].solid && a.hp > 0)
    .flatMap((a) => {
      const r = footprint(a);
      return r ? [r] : [];
    });
}
export { CORE };
