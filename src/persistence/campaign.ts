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
import { ASSET_XP_CAP, assetLevel, applyRankXP } from '../progression/allocation';
import { growthFactors, scaleFixed } from '../progression/growth';
import { developingSlice } from '../progression/profile';
import { quoteEnhancement } from '../progression/purchases';
export const CAMPAIGN_PROGRESSION_POLICY = 'campaign.progression-slice-v1';
const placement = z
  .object({
    x: z.number().int().min(0).max(59),
    y: z.number().int().min(0).max(59),
    rotation: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();
export const legacyOwnedSchema = z
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
export const legacyCampaignSchema = z
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
    assets: z.array(legacyOwnedSchema).max(1024),
  })
  .strict();
export const progressedOwnedSchema = legacyOwnedSchema.extend({
  xp: z.number().int().min(0).max(ASSET_XP_CAP),
  level: z.number().int().min(1).max(100),
  enhancement: z.number().int().min(0).max(10),
  enhancementPaid: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  permanentCharges: z.number().int().min(0).max(8).nullable(),
});
export const progressionCampaignSchema = legacyCampaignSchema.extend({
  schema: z.literal(2),
  build: z.literal('0.2.6-progression'),
  simulationVersion: z.literal('rb-sim-v3'),
  progressionPolicy: z.literal(CAMPAIGN_PROGRESSION_POLICY),
  rank: z.number().int().min(1).max(100),
  accountXP: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  lifetimeXP: z
    .string()
    .regex(/^(0|[1-9][0-9]{0,38})$/)
    .refine((s) => BigInt(s) <= (1n << 128n) - 1n),
  lifetimeXPSaturated: z.boolean(),
  promotionCores: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  coreHP: z
    .number()
    .int()
    .min(0)
    .max(coreBaseline.hp * 1024),
  assets: z.array(progressedOwnedSchema).max(1024),
});
export const campaignSchema = z.discriminatedUnion('schema', [
  legacyCampaignSchema,
  progressionCampaignSchema,
]);
export const ownedSchema = z.union([legacyOwnedSchema, progressedOwnedSchema]);
export type Campaign = z.infer<typeof campaignSchema>;
export type Owned = z.infer<typeof ownedSchema>;
export type ProgressionCampaign = z.infer<typeof progressionCampaignSchema>;
export type ProgressedOwned = z.infer<typeof progressedOwnedSchema>;
export function maximumBody(a: Owned): number {
  const d = foundation[a.type];
  return d.developing
    ? scaleFixed(d.hp * 1024, growthFactors(a.level, a.enhancement).health)
    : d.hp * 1024;
}
export function rankAllowances(rank: number) {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > 100)
    throw new Error('Rank allowance domain');
  return {
    capacity: 20 + Math.floor((100 * (rank - 1)) / 99),
    barriers: 40 + Math.floor((160 * (rank - 1)) / 99),
    traps: 8 + Math.floor((32 * (rank - 1)) / 99),
  };
}
/** Explicit pure migration; the repository commits it only with no active run.
 * Keeps identity, wallet, wounds and placement. Legacy battles were clones, so
 * their charge use never consumed permanent campaign stock.
 */
export function migrateProgression(input: unknown): ProgressionCampaign {
  const before = validateCampaign(input);
  if (before.schema === 2) return structuredClone(before);
  return validateCampaign({
    ...before,
    schema: 2,
    build: '0.2.6-progression',
    simulationVersion: 'rb-sim-v3',
    progressionPolicy: CAMPAIGN_PROGRESSION_POLICY,
    revision: before.revision + 1,
    lifetimeXP: '0',
    lifetimeXPSaturated: false,
    assets: before.assets.map((a) => ({
      ...a,
      enhancementPaid: 0,
      permanentCharges: a.type === 'friendly.proximity_mine' ? 1 : null,
    })),
  }) as ProgressionCampaign;
}
export function newAsset(type: ContentID, paidCredits = 0): z.infer<typeof legacyOwnedSchema> {
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
): z.infer<typeof legacyCampaignSchema> {
  if (/[\p{Cc}]/u.test(name)) throw new Error('Campaign name contains a control character');
  const assets: z.infer<typeof legacyOwnedSchema>[] = [newAsset(warden)];
  for (const [type, count] of doctrines[doctrine])
    for (let i = 0; i < count; i++) assets.push(newAsset(type));
  return legacyCampaignSchema.parse({
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
  if (c.schema === 2) {
    applyRankXP(c.rank, c.accountXP, 0n, BigInt(c.lifetimeXP), c.lifetimeXPSaturated);
    if (
      (c.rank < 100 && (c.lifetimeXP !== '0' || c.lifetimeXPSaturated)) ||
      (c.lifetimeXPSaturated && BigInt(c.lifetimeXP) !== (1n << 128n) - 1n)
    )
      throw new Error('Lifetime XP state mismatch');
    for (const a of c.assets) {
      if (a.level !== assetLevel(a.xp)) throw new Error('Owned XP/level mismatch');
      if (
        !(developingSlice as readonly string[]).includes(a.type) &&
        (a.xp !== 0 || a.enhancement !== 0)
      )
        throw new Error('Type progression not implemented');
      growthFactors(a.level, a.enhancement);
      let investment = 0;
      for (let tier = 0; tier < a.enhancement; tier++)
        investment += quoteEnhancement(
          foundation[a.type].category === 'warden' ? 500 : foundation[a.type].cost,
          100,
          tier,
        ).credits;
      if (a.enhancementPaid !== investment)
        throw new Error('Enhancement investment ledger mismatch');
      if (
        a.type === 'friendly.proximity_mine'
          ? a.permanentCharges === null || a.permanentCharges > 1
          : a.permanentCharges !== null
      )
        throw new Error('Permanent charge identity/stock mismatch');
    }
  }
  for (const a of c.assets) {
    if (ids.has(a.id)) throw new Error('Duplicate owned identity');
    ids.add(a.id);
    const d = foundation[a.type];
    if (a.hp > maximumBody(a)) throw new Error('Durability exceeds maximum');
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
    if (a.hp === 0 && c.schema === 1)
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
    if (d.solid && a.hp > 0) solids.push(r);
  }
  if (!wardens.has(c.warden)) throw new Error('Selected Warden ownership missing');
  const totals = accounting(c);
  const allowed = rankAllowances(c.rank);
  if (totals.capacity > allowed.capacity)
    throw new Error(`Rank ${c.rank} capacity limit is ${allowed.capacity}`);
  if (totals.barriers > allowed.barriers)
    throw new Error(`Rank ${c.rank} barrier allowance is ${allowed.barriers} cells`);
  if (totals.traps > allowed.traps)
    throw new Error(`Rank ${c.rank} trap allowance is ${allowed.traps}`);
  if (totals.entities > 80) throw new Error('Deployed entity limit is 80');
  const route = validateRoutes(solids);
  if (route) throw new Error(route);
  return c;
}
export type PreparationCommand =
  | { kind: 'place'; id: string; x: number; y: number; rotation: 0 | 1 | 2 | 3 }
  | { kind: 'store'; id: string }
  | { kind: 'buy-place'; type: ContentID; x: number; y: number; rotation: 0 | 1 | 2 | 3 };
export function applyCommand(
  before: z.infer<typeof legacyCampaignSchema>,
  command: PreparationCommand,
): z.infer<typeof legacyCampaignSchema>;
export function applyCommand(
  before: ProgressionCampaign,
  command: PreparationCommand,
): ProgressionCampaign;
export function applyCommand(before: Campaign, command: PreparationCommand): Campaign;
export function applyCommand(before: Campaign, command: PreparationCommand): Campaign {
  const c = structuredClone(before);
  if (command.kind === 'buy-place') {
    const d = foundation[command.type];
    if (d.rank > c.rank || d.category === 'warden') throw new Error('Purchase not unlocked');
    if (c.credits < d.cost) throw new Error('Insufficient Credits');
    c.credits -= d.cost;
    const a = newAsset(command.type, d.cost);
    a.placement = { x: command.x, y: command.y, rotation: command.rotation };
    if (c.schema === 2)
      c.assets.push({
        ...a,
        enhancementPaid: 0,
        permanentCharges: a.type === 'friendly.proximity_mine' ? 1 : null,
      });
    else c.assets.push(a);
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
