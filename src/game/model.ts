import { z } from 'zod';
import { definition, FRIENDLIES, type Faction } from './catalog';
import { growthFactors, scaleFixed } from '../progression/growth';
import { assetLevel } from '../progression/allocation';
export const FULL_VERSION = 'rb-full-first-pass-v1';
export const BUILD = '0.3.0-first-pass';
const point = z
  .object({ x: z.number().int().min(0).max(59), y: z.number().int().min(0).max(59) })
  .strict();
export const placementSchema = point.extend({ rotation: z.number().int().min(0).max(3) });
const tacticsSchema = z
  .object({
    posture: z.enum(['Defensive', 'Balanced', 'Aggressive']),
    anchor: point,
    secondary: point.nullable(),
    sector: z.number().int().min(0).max(6),
    heading: z.number().int().min(0).max(359),
    priorities: z
      .array(z.enum(['Core threats', 'Support', 'Elite', 'Air', 'Nearest']))
      .length(5)
      .refine((a) => new Set(a).size === 5),
    core: z.enum(['Low', 'Normal', 'High']),
    ability: z.enum(['Frequent', 'Balanced', 'Conservative', 'Emergency', 'Disabled']),
    spacing: z.enum(['Compact', 'Balanced', 'Spread']),
    groundFallback: z.boolean(),
    gate: z.enum(['Open', 'Closed', 'Allied passage']),
  })
  .strict();
export type Tactics = z.infer<typeof tacticsSchema>;
export function defaultTactics(): Tactics {
  return {
    posture: 'Balanced',
    anchor: { x: 25, y: 30 },
    secondary: null,
    sector: 0,
    heading: 270,
    priorities: ['Core threats', 'Support', 'Elite', 'Air', 'Nearest'],
    core: 'Normal',
    ability: 'Balanced',
    spacing: 'Balanced',
    groundFallback: true,
    gate: 'Open',
  };
}
export const assetSchema = z
  .object({
    id: z.uuid(),
    type: z.string().refine((id) => FRIENDLIES.some((d) => d.id === id)),
    hp: z.number().int().min(0),
    xp: z.number().int().min(0).max(78498),
    level: z.number().int().min(1).max(100),
    enhancement: z.number().int().min(0).max(10),
    stars: z.number().int().min(1).max(6),
    branch: z.enum(['A', 'B']).nullable(),
    doctrineRole: z.enum(['Core threats', 'Support', 'Elite', 'Air', 'Nearest']).nullable(),
    enhancementPaid: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    coresPaid: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    basePaid: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    charges: z.number().int().min(0).max(8).nullable(),
    placement: placementSchema.nullable(),
    tactics: tacticsSchema,
    emergency: z.boolean(),
    refundLocked: z.boolean(),
  })
  .strict()
  .superRefine((a, c) => {
    const d = definition(a.type);
    if (
      a.level !== assetLevel(a.xp) ||
      a.enhancement > Math.floor(a.level / 10) ||
      a.hp > maxHealth(a) ||
      a.stars >= 3 !== (a.branch !== null) ||
      (d.charges === null ? a.charges !== null : a.charges === null || a.charges > d.charges) ||
      (!d.profile && (a.level !== 1 || a.enhancement !== 0 || a.stars !== 1))
    )
      c.addIssue({ code: 'custom', message: 'Asset progression/body/stock mismatch' });
  });
export type Asset = z.infer<typeof assetSchema>;
export function maxHealth(
  a: Pick<Asset, 'type' | 'level' | 'enhancement' | 'stars' | 'branch'>,
): number {
  const d = definition(a.type);
  return Math.round(
    scaleFixed(d.health * 1024, growthFactors(a.level, a.enhancement).health) *
      (d.id === 'friendly.elevated_firing_platform' && a.stars >= 2 ? 1.15 : 1),
  );
}
export type Mode =
  | 'Campaign'
  | 'Expedition'
  | 'Boss Siege'
  | 'Archive'
  | 'Calibration'
  | 'Mastery'
  | 'Endurance'
  | 'Long Watch';
export type Difficulty = 'Cadet' | 'Standard' | 'Veteran' | 'Master' | 'Cataclysm';
export type Modifier = 'crossfire' | 'armoured' | 'support' | 'elite';
export interface Spawn {
  tick: number;
  faction: Faction;
  packet: number;
  type: string;
  rank: 0 | 1 | 2 | 3;
  entrance: number;
  segment: number;
  qtp: number;
  children: number;
  position?: { x: number; y: number } | undefined;
}
export interface Plan {
  version: typeof FULL_VERSION;
  id: string;
  seed: string;
  mode: Mode;
  originMode: Mode | null;
  following: Plan[];
  mastery: boolean;
  practice: PracticeRules | null;
  secondaryFaction: Faction | null;
  attempt: number;
  budgetQTP: number[];
  discardedQTP: number;
  name: string;
  requiredRank: number;
  band: number;
  difficulty: Difficulty;
  modifiers: Modifier[];
  tier: number;
  faction: 'Fracture' | 'Iron' | 'Hollow' | 'Maw';
  duration: 90 | 120 | 180 | 240 | 300 | 420;
  block: number;
  blocks: number;
  stage: number | null;
  trial: number | null;
  boss: string | null;
  recipe: string;
  pressure: number[];
  pressureFractions: { n: number; d: number }[];
  spawns: Spawn[];
  hash: string;
  objectives: string[];
}
export interface Performance {
  id: string;
  type: string;
  damage: number;
  healing: number;
  shield: number;
  contribution: number;
  operational: boolean;
  blocks: number;
  endingHP: number;
  endingCharges: number | null;
  reasons: Record<string, number>;
}
export interface Result {
  id: string;
  sequence: string;
  epoch: number;
  plan: Plan;
  outcome: 'Victory' | 'Defeat';
  practice: boolean;
  seconds: number;
  coreHP: number;
  performance: Performance[];
  armyFingerprint: string;
  allocations: { id: string; granted: string; level: number }[];
  unusedAssetXP: string;
  killed: Record<string, number>;
  discovered: string[];
  timeline: { second: number; friendly: number; enemy: number }[];
  heatmap: number[];
  buckets: {
    block: number;
    segment: number;
    pressure: number;
    pressureFraction: { n: number; d: number };
    plannedQTP: number;
    destroyedQTP: number;
  }[];
  wrecks: number;
  events: string[];
  credits: string;
  xp: string;
  assetXP: string;
  cores: string;
  bonuses: string[];
  claimed: boolean;
  clipped: string;
}
export interface ActiveRun {
  id: string;
  sequence: string;
  epoch: number;
  plan: Plan;
  rootPlan: Plan;
  engine: { accuracy: number; nextID: number } | null;
  start: GameState;
  completed: Result[];
  block: number;
  signatureShots: Record<string, number>;
  signatures: Record<string, 'locked' | 'armed' | 'pending' | 'active' | 'used' | 'disabled'>;
}
export interface Preset {
  name: string;
  placements: { id: string; placement: Asset['placement']; tactics: Tactics }[];
}
export interface GameState {
  version: typeof FULL_VERSION;
  id: string;
  slot: number;
  name: string;
  revision: number;
  updated: number;
  doctrine: 'Bastion' | 'Mobile' | 'Chokepoint';
  warden: string;
  rank: number;
  rankXP: number;
  lifetimeXP: string;
  totals: {
    sieges: number;
    victories: number;
    defeats: number;
    seconds: number;
    kills: number;
    damage: number;
    healing: number;
    shield: number;
  };
  credits: number;
  cores: number;
  coreHP: number;
  assets: Asset[];
  land: string[];
  stages: number[];
  trials: number[];
  discoveries: string[];
  generatedClaims: string[];
  generatedBonusClosed: boolean;
  sequence: string;
  finalized: string;
  epoch: number;
  retired: { epoch: number; finalized: string; sequence: string }[];
  receipts: string[];
  watchOrdinal: string;
  watchEpoch: number;
  history: Result[];
  archive: Plan[];
  favorites: string[];
  presets: Preset[];
  comparisons: Result[];
  active: ActiveRun | null;
  pending: Result | null;
  emergencyEpisode: boolean;
  settings: Settings;
  watch: WatchSeries | null;
  closedWatches: { name: string; sorties: number; cleared: number; best: number }[];
  cosmetics: string[];
  appearance: {
    ground: string | null;
    trim: string | null;
    banner: string | null;
    plaque: string | null;
    hud: string | null;
  };
}
export interface PracticeRules {
  capacity: number;
  traps: number;
  barriers: number;
  warden: string;
  exclusions: string[];
  flipBranches: boolean;
  fullRepair: boolean;
}
export interface WatchSeries {
  id: string;
  rootSeed: string;
  band: number;
  difficulty: Difficulty;
  modifiers: Modifier[];
  tier: number;
  mastery: boolean;
  parked: boolean;
  rerolls: number;
  offers: Plan[];
  sorties: number;
  cleared: number;
  streak: number;
  best: number;
  lastBoss: string | null;
  recent: string[];
}
export interface Settings {
  master: number;
  alerts: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
  reducedEffects: boolean;
  highContrast: boolean;
  uiScale: number;
  quality: 'Auto' | 'High' | 'Low';
  captions: boolean;
  confirmSpending: boolean;
}
export const defaultSettings = (): Settings => ({
  master: 0.7,
  alerts: 0.75,
  music: 0.35,
  sfx: 0.65,
  ui: 0.5,
  muted: false,
  reducedEffects: false,
  highContrast: false,
  uiScale: 100,
  quality: 'Auto',
  captions: true,
  confirmSpending: true,
});
export function makeAsset(type: string, paid = true): Asset {
  const d = definition(type);
  return {
    id: crypto.randomUUID(),
    type,
    hp: d.health * 1024,
    xp: 0,
    level: 1,
    enhancement: 0,
    stars: 1,
    branch: null,
    doctrineRole: null,
    enhancementPaid: 0,
    coresPaid: 0,
    basePaid: paid ? d.cost : 0,
    charges: d.charges,
    placement: null,
    tactics: defaultTactics(),
    emergency: false,
    refundLocked: false,
  };
}
export function newGame(
  name: string,
  slot: number,
  doctrine: GameState['doctrine'],
  warden: string,
): GameState {
  const starters: { [K in GameState['doctrine']]: [string, number][] } = {
    Bastion: [
      ['friendly.sentry', 2],
      ['friendly.rifle_squad', 1],
      ['friendly.standard_barricade', 6],
      ['friendly.proximity_mine', 2],
      ['friendly.repair_node', 1],
    ],
    Mobile: [
      ['friendly.sentry', 1],
      ['friendly.rifle_squad', 2],
      ['friendly.combat_engineers', 1],
      ['friendly.standard_barricade', 4],
      ['friendly.proximity_mine', 2],
    ],
    Chokepoint: [
      ['friendly.sentry', 1],
      ['friendly.rifle_squad', 1],
      ['friendly.standard_barricade', 8],
      ['friendly.slow_field', 2],
      ['friendly.proximity_mine', 2],
      ['friendly.repair_node', 1],
    ],
  };
  if (!['warden.bulwark', 'warden.ranger', 'warden.conductor'].includes(warden))
    throw new Error('Select a Warden');
  const assets = [
    makeAsset(warden, false),
    ...starters[doctrine].flatMap(([type, count]) =>
      Array.from({ length: count }, () => makeAsset(type, false)),
    ),
  ];
  return {
    version: FULL_VERSION,
    id: crypto.randomUUID(),
    slot,
    name: Array.from(name.trim()).slice(0, 32).join('') || 'My Bastion',
    revision: 0,
    updated: Date.now(),
    doctrine,
    warden,
    rank: 1,
    rankXP: 0,
    lifetimeXP: '0',
    totals: {
      sieges: 0,
      victories: 0,
      defeats: 0,
      seconds: 0,
      kills: 0,
      damage: 0,
      healing: 0,
      shield: 0,
    },
    credits: 600,
    cores: 0,
    coreHP: 10240000,
    assets,
    land: [],
    stages: [],
    trials: [],
    discoveries: [],
    generatedClaims: [],
    generatedBonusClosed: false,
    sequence: '0',
    finalized: '0',
    epoch: 0,
    retired: [],
    receipts: [],
    watchOrdinal: '1',
    watchEpoch: 0,
    history: [],
    archive: [],
    favorites: [],
    presets: [],
    comparisons: [],
    active: null,
    pending: null,
    emergencyEpisode: false,
    settings: defaultSettings(),
    watch: null,
    closedWatches: [],
    cosmetics: [],
    appearance: { ground: null, trim: null, banner: null, plaque: null, hud: null },
  };
}
export function assertGame(value: unknown, depth = 0): asserts value is GameState {
  if (depth > 1 || !value || typeof value !== 'object') throw new Error('Invalid campaign');
  const s = value as GameState;
  if (
    s.version !== FULL_VERSION ||
    !z.uuid().safeParse(s.id).success ||
    !Number.isInteger(s.slot) ||
    s.slot < 0 ||
    s.slot > 2 ||
    typeof s.name !== 'string' ||
    !s.name.trim() ||
    Array.from(s.name).length > 32
  )
    throw new Error('Unsupported campaign header');
  for (const [n, lo, hi] of [
    [s.rank, 1, 100],
    [s.rankXP, 0, Number.MAX_SAFE_INTEGER],
    [s.credits, 0, Number.MAX_SAFE_INTEGER],
    [s.cores, 0, Number.MAX_SAFE_INTEGER],
    [s.coreHP, 0, 10240000],
    [s.revision, 0, Number.MAX_SAFE_INTEGER],
  ] as const)
    if (!Number.isSafeInteger(n) || n < lo || n > hi) throw new Error('Invalid campaign bounds');
  for (const n of [s.sequence, s.finalized, s.watchOrdinal])
    if (typeof n !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(n) || BigInt(n) > (1n << 64n) - 1n)
      throw new Error('Invalid run counter');
  if (
    typeof s.lifetimeXP !== 'string' ||
    !/^(0|[1-9][0-9]{0,38})$/.test(s.lifetimeXP) ||
    BigInt(s.lifetimeXP) > (1n << 128n) - 1n
  )
    throw new Error('Invalid lifetime XP');
  if (!Array.isArray(s.assets) || s.assets.length > 1024) throw new Error('Owned asset bound');
  s.assets.forEach((a) => {
    assetSchema.parse(a);
  });
  if (
    new Set(s.assets.map((a) => a.id)).size !== s.assets.length ||
    !s.assets.some((a) => a.type === s.warden) ||
    new Set(s.assets.filter((a) => definition(a.type).category === 'warden').map((a) => a.type))
      .size !== s.assets.filter((a) => definition(a.type).category === 'warden').length
  )
    throw new Error('Duplicate identity or missing Warden');
  for (const [list, bound] of [
    [s.stages, 40],
    [s.trials, 12],
    [s.discoveries, 24],
    [s.generatedClaims, 4096],
    [s.receipts, 16],
    [s.history, 100],
    [s.archive, 32],
    [s.favorites, 32],
    [s.presets, 5],
    [s.comparisons, 64],
    [s.land, 8],
  ] as const)
    if (!Array.isArray(list) || list.length > bound) throw new Error('Campaign collection bound');
  if (s.active) {
    assertGame(s.active.start, depth + 1);
    if (s.active.start.active || s.active.start.pending || s.active.sequence !== s.sequence)
      throw new Error('Invalid active run');
  }
  if (s.pending && s.pending.sequence !== s.sequence)
    throw new Error('Pending result sequence mismatch');
}
