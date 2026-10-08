import { COSMETICS } from './workshop';
import { z } from 'zod';
import { assetSchema, FULL_VERSION, maxHealth, type GameState, type Plan } from './model';
import { CATALOG, definition } from './catalog';
import { assetLevel } from '../progression/allocation';
import thresholds from '../data/progression.json';
import { validateLayout } from './construction';
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  counter = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,19})$/)
    .refine((v) => BigInt(v) < 1n << 64n),
  wide = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,38})$/)
    .refine((v) => BigInt(v) < 1n << 128n);
const numeric = z.string().regex(/^(0|[1-9][0-9]{0,100})$/),
  id = z
    .string()
    .max(128)
    .refine((v) => CATALOG.some((d) => d.id === v));
const mode = z.enum([
  'Campaign',
  'Expedition',
  'Boss Siege',
  'Archive',
  'Calibration',
  'Mastery',
  'Endurance',
  'Long Watch',
]);
const fraction = z
  .object({ n: integer, d: integer.min(1) })
  .strict()
  .refine((v) => v.n <= v.d);
const spawn = z
  .object({
    tick: integer.max(25200),
    faction: z.enum(['Fracture', 'Iron', 'Hollow', 'Maw']),
    packet: integer.max(10000),
    type: id,
    rank: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    entrance: integer.max(5),
    segment: integer.min(1).max(21),
    qtp: integer,
    children: integer.max(8),
    position: z
      .object({ x: integer.max(61440), y: integer.max(61440) })
      .strict()
      .optional(),
  })
  .strict();
export const planSchema: z.ZodType<Plan> = z.lazy(() =>
  z
    .object({
      version: z.literal(FULL_VERSION),
      id: z.uuid(),
      seed: z.string().min(1).max(256),
      mode,
      originMode: mode.nullable(),
      following: z.array(planSchema).max(5),
      mastery: z.boolean(),
      practice: z
        .object({
          capacity: integer.max(120),
          traps: integer.max(40),
          barriers: integer.max(200),
          warden: id,
          exclusions: z.array(id).max(43),
          flipBranches: z.boolean(),
          fullRepair: z.boolean(),
        })
        .strict()
        .nullable(),
      secondaryFaction: z.enum(['Fracture', 'Iron', 'Hollow', 'Maw']).nullable(),
      attempt: integer.max(9),
      budgetQTP: z.array(integer).max(21),
      discardedQTP: integer,
      name: z.string().min(1).max(256),
      requiredRank: integer.min(1).max(100),
      band: integer.min(1).max(20),
      difficulty: z.enum(['Cadet', 'Standard', 'Veteran', 'Master', 'Cataclysm']),
      modifiers: z
        .array(z.enum(['crossfire', 'armoured', 'support', 'elite']))
        .max(2)
        .refine((a) => new Set(a).size === a.length),
      tier: integer.max(8),
      faction: z.enum(['Fracture', 'Iron', 'Hollow', 'Maw']),
      duration: z.union([
        z.literal(90),
        z.literal(120),
        z.literal(180),
        z.literal(240),
        z.literal(300),
        z.literal(420),
      ]),
      block: integer.min(1).max(6),
      blocks: integer.min(1).max(6),
      stage: integer.max(39).nullable(),
      trial: integer.max(11).nullable(),
      boss: z
        .string()
        .refine((v) => CATALOG.some((d) => d.id === v && d.category === 'boss'))
        .nullable(),
      recipe: z.string().max(64),
      pressure: z.array(z.number().min(0).max(100)).min(2).max(21),
      pressureFractions: z.array(fraction).min(2).max(21),
      spawns: z.array(spawn).max(4096),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      objectives: z.array(z.enum(['warden_survives', 'core_75', 'no_wrecks'])).length(2),
    })
    .strict()
    .superRefine((p, c) => {
      if (
        p.block > p.blocks ||
        p.pressure.length !== p.pressureFractions.length ||
        p.spawns.some((v, i) => i > 0 && v.tick < p.spawns[i - 1]!.tick) ||
        p.spawns.some((v) => !['enemy', 'boss'].includes(definition(v.type).category)) ||
        p.spawns.filter((v) => definition(v.type).category === 'boss').length > 1
      )
        c.addIssue({ code: 'custom', message: 'Encounter plan invariants' });
    }),
);
const performanceSchema = z
  .object({
    id: z.uuid(),
    type: id,
    damage: integer,
    healing: integer,
    shield: integer,
    contribution: integer,
    operational: z.boolean(),
    blocks: integer.max(6),
    endingHP: integer,
    endingCharges: integer.max(8).nullable(),
    reasons: z.record(z.string().max(128), integer),
  })
  .strict();
export const resultSchema = z
  .object({
    id: z.string().min(1).max(256),
    sequence: counter,
    epoch: integer,
    plan: planSchema,
    outcome: z.enum(['Victory', 'Defeat']),
    practice: z.boolean(),
    seconds: z.number().finite().min(0).max(604800),
    coreHP: integer.max(10240000),
    performance: z.array(performanceSchema).max(1024),
    armyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    allocations: z
      .array(z.object({ id: z.uuid(), granted: numeric, level: integer.min(1).max(100) }).strict())
      .max(1024),
    unusedAssetXP: numeric,
    killed: z.record(id, integer),
    discovered: z.array(id).max(24),
    timeline: z
      .array(
        z
          .object({ second: z.number().finite().min(0), friendly: integer, enemy: integer })
          .strict(),
      )
      .max(21600),
    heatmap: z.array(integer).length(36),
    buckets: z
      .array(
        z
          .object({
            block: integer.min(1).max(6),
            segment: integer.min(1).max(21),
            pressure: z.number().min(0).max(100),
            pressureFraction: fraction,
            plannedQTP: integer,
            destroyedQTP: integer,
          })
          .strict(),
      )
      .max(126),
    wrecks: integer.max(1024),
    events: z.array(z.string().max(512)).max(100),
    credits: numeric,
    xp: numeric,
    assetXP: numeric,
    cores: numeric,
    bonuses: z.array(z.string().max(512)).max(128),
    claimed: z.boolean(),
    clipped: numeric,
  })
  .strict()
  .superRefine((r, c) => {
    if (
      r.buckets.some((b) => b.destroyedQTP > b.plannedQTP) ||
      new Set(r.performance.map((p) => p.id)).size !== r.performance.length
    )
      c.addIssue({ code: 'custom', message: 'Result conservation/identity failure' });
  });
const settingsSchema = z
  .object({
    master: z.number().min(0).max(1),
    alerts: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    ui: z.number().min(0).max(1),
    muted: z.boolean(),
    reducedEffects: z.boolean(),
    highContrast: z.boolean(),
    uiScale: integer.min(100).max(200),
    quality: z.enum(['Auto', 'High', 'Low']),
    captions: z.boolean(),
    confirmSpending: z.boolean(),
  })
  .strict();
export const gameSchema: z.ZodType<GameState> = z.lazy(() =>
  z
    .object({
      version: z.literal(FULL_VERSION),
      id: z.uuid(),
      slot: integer.max(2),
      name: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .refine((v) => Array.from(v).length <= 32 && !/[\p{Cc}]/u.test(v)),
      revision: integer,
      updated: integer,
      doctrine: z.enum(['Bastion', 'Mobile', 'Chokepoint']),
      warden: z.enum(['warden.bulwark', 'warden.ranger', 'warden.conductor']),
      rank: integer.min(1).max(100),
      rankXP: integer,
      lifetimeXP: wide,
      totals: z
        .object({
          sieges: integer,
          victories: integer,
          defeats: integer,
          seconds: integer,
          kills: integer,
          damage: integer,
          healing: integer,
          shield: integer,
        })
        .strict(),
      credits: integer,
      cores: integer,
      coreHP: integer.max(10240000),
      assets: z.array(assetSchema).max(1024),
      land: z.array(z.enum(['North', 'East', 'South', 'West', 'NW', 'NE', 'SE', 'SW'])).max(8),
      stages: z.array(integer.max(39)).max(40),
      trials: z.array(integer.max(11)).max(12),
      discoveries: z.array(id).max(24),
      generatedClaims: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(4096),
      generatedBonusClosed: z.boolean(),
      sequence: counter,
      finalized: counter,
      epoch: integer,
      retired: z
        .array(z.object({ epoch: integer, sequence: counter, finalized: counter }).strict())
        .max(2),
      receipts: z.array(z.string().max(256)).max(16),
      watchOrdinal: counter,
      watchEpoch: integer,
      history: z.array(resultSchema).max(100),
      archive: z.array(planSchema).max(32),
      favorites: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(32),
      presets: z
        .array(
          z
            .object({
              name: z.string().min(1).max(32),
              placements: z
                .array(
                  z
                    .object({
                      id: assetSchema.shape.id,
                      placement: assetSchema.shape.placement,
                      tactics: assetSchema.shape.tactics,
                    })
                    .strict(),
                )
                .max(1024),
            })
            .strict(),
        )
        .max(5),
      comparisons: z.array(resultSchema).max(64),
      active: z
        .object({
          id: z.string().max(256),
          sequence: counter,
          epoch: integer,
          plan: planSchema,
          rootPlan: planSchema,
          engine: z
            .object({ accuracy: integer.min(1).max(4294967295), nextID: integer.min(1) })
            .strict()
            .nullable(),
          start: gameSchema,
          completed: z.array(resultSchema).max(5),
          block: integer.min(1).max(6),
          signatureShots: z.record(z.uuid(), integer.max(5)),
          signatures: z.record(
            z.uuid(),
            z.enum(['locked', 'armed', 'pending', 'active', 'used', 'disabled']),
          ),
        })
        .strict()
        .nullable(),
      pending: resultSchema.nullable(),
      emergencyEpisode: z.boolean(),
      settings: settingsSchema,
      watch: z
        .object({
          id: z.uuid(),
          rootSeed: z.string().max(256),
          band: integer.min(1).max(20),
          difficulty: z.enum(['Cadet', 'Standard', 'Veteran', 'Master', 'Cataclysm']),
          modifiers: z.array(z.enum(['crossfire', 'armoured', 'support', 'elite'])).max(2),
          tier: integer.max(8),
          mastery: z.boolean(),
          parked: z.boolean(),
          rerolls: integer,
          offers: z.array(planSchema).max(3),
          sorties: integer,
          cleared: integer,
          streak: integer,
          best: integer,
          lastBoss: id.nullable(),
          recent: z.array(z.string().max(256)).max(20),
        })
        .strict()
        .nullable(),
      closedWatches: z
        .array(
          z
            .object({ name: z.string().max(64), sorties: integer, cleared: integer, best: integer })
            .strict(),
        )
        .max(20),
      cosmetics: z.array(z.string().regex(/^COS(0[1-9]|1[0-2])$/)).max(12),
      appearance: z
        .object({
          ground: z.string().nullable(),
          trim: z.string().nullable(),
          banner: z.string().nullable(),
          plaque: z.string().nullable(),
          hud: z.string().nullable(),
        })
        .strict(),
    })
    .strict(),
);
export function validateSnapshot(raw: unknown): GameState {
  const s = gameSchema.parse(raw);
  for (const list of [
    s.land,
    s.stages,
    s.trials,
    s.discoveries,
    s.generatedClaims,
    s.receipts,
    s.favorites,
  ])
    if (new Set<string | number>(list).size !== list.length)
      throw new Error('Duplicate campaign claims or references');
  if (s.favorites.some((id) => !s.archive.some((p) => p.hash === id)))
    throw new Error('Favorite plan is not retained in the archive');
  if (s.rank === 100 ? s.rankXP !== 0 : s.rankXP >= (thresholds.rankNext[s.rank - 1] ?? 0))
    throw new Error('Invalid rank progress');
  if (
    s.assets.some((a) => a.level !== assetLevel(a.xp)) ||
    new Set(s.assets.map((a) => a.id)).size !== s.assets.length
  )
    throw new Error('Invalid asset identities or XP');
  if (BigInt(s.finalized) > BigInt(s.sequence) || s.retired.some((r) => r.epoch >= s.epoch))
    throw new Error('Run watermark mismatch');
  if (
    new Set(s.cosmetics).size !== s.cosmetics.length ||
    s.cosmetics.some((id) => !COSMETICS.some((c) => c.id === id))
  )
    throw new Error('Invalid purchased appearance');
  for (const [kind, id] of Object.entries(s.appearance))
    if (id && (!s.cosmetics.includes(id) || !COSMETICS.some((c) => c.id === id && c.kind === kind)))
      throw new Error('Equipped appearance is not owned or has the wrong slot');
  if (
    s.watch &&
    (s.watch.cleared > s.watch.sorties ||
      s.watch.streak > s.watch.best ||
      s.watch.best > s.watch.cleared ||
      s.watch.band > Math.floor((s.rank - 1) / 5) + 1 ||
      new Set(s.watch.modifiers).size !== s.watch.modifiers.length)
  )
    throw new Error('Invalid Watch aggregate or declared profile');
  const layout = validateLayout(s, false);
  if (layout.length) throw new Error(layout.join('; '));
  if (s.active) {
    if (
      s.active.start.active ||
      s.active.start.pending ||
      s.active.start.id !== s.id ||
      s.active.start.slot !== s.slot ||
      s.active.sequence !== s.sequence ||
      s.active.epoch !== s.epoch ||
      BigInt(s.active.sequence) <= BigInt(s.finalized)
    )
      throw new Error('Active checkpoint/namespace mismatch');
    validateSnapshot(s.active.start);
  }
  if (s.pending) {
    if (
      !s.active ||
      s.pending.sequence !== s.active.sequence ||
      s.pending.epoch !== s.epoch ||
      s.pending.id !== s.active.id ||
      s.pending.plan.hash !== s.active.rootPlan.hash
    )
      throw new Error('Pending result/checkpoint mismatch');
    for (const p of s.pending.performance) {
      const a = s.active.start.assets.find((a) => a.id === p.id);
      if (
        !a ||
        a.type !== p.type ||
        p.endingHP > maxHealth(a) ||
        (p.endingCharges !== null &&
          (definition(a.type).charges === null || p.endingCharges > definition(a.type).charges!))
      )
        throw new Error('Pending result body identity mismatch');
    }
  }
  return s;
}
