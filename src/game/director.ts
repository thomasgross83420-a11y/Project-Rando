import { compareIDs } from './order';
import { RandomStream, hash } from '../sim/determinism';
import { resamplePressure } from '../economy/policy';
import {
  FULL_VERSION,
  type Plan,
  type Spawn,
  type Mode,
  type Difficulty,
  type Modifier,
} from './model';
import { BOSSES, ENEMIES, FACTIONS, SUPPORT_ROLES, definition, type Faction } from './catalog';
export const CHAPTERS = [
  'Fractured Approach',
  'Iron Advance',
  'Veiled Siege',
  'Hunger at the Walls',
  'Skyfall',
  'Marshal’s Offensive',
  'Broken Network',
  'The Last Root',
];
export const CHAPTER_RANKS = [1, 6, 16, 23, 35, 50, 70, 90];
export const DIFFICULTY_THREAT: Record<Difficulty, number> = {
  Cadet: 0.75,
  Standard: 1,
  Veteran: 1.2,
  Master: 1.45,
  Cataclysm: 1.75,
};
export const RECIPES = [
  'Balanced',
  'Armored',
  'Air',
  'Infiltration',
  'Support',
  'Alternating fronts',
];
export const SPECIALIST_ROLES = new Set([
  'enemy.veil',
  'enemy.mole',
  'enemy.sapper',
  'enemy.drainer',
  'enemy.carrier',
  'enemy.harvester',
]);
const armored = new Set(['enemy.bulwark', 'enemy.breaker', 'enemy.bombard']),
  stealth = new Set(['enemy.veil', 'enemy.mole']);
export interface CompileInput {
  mode: Mode;
  mastery?: boolean;
  seed: string;
  rank: number;
  difficulty: Difficulty;
  stage?: number;
  trial?: number;
  band?: number;
  boss?: string | null;
  recipe?: string;
  modifiers?: Modifier[];
  tier?: number;
  blocks?: number;
  block?: number;
  pressure?: 'original' | 'reverse' | 'rotate';
  secondary?: boolean;
  calibration?: { type: string; count: number; variant: 0 | 1 | 2 | 3; entrance: number };
}
export const bossReserve: Record<string, { type: string; count: number; qtp: number }> = {
  'boss.prism_sovereign': { type: 'special.prism', count: 3, qtp: 24 },
  'boss.choir_dreadnought': { type: 'enemy.bulwark', count: 2, qtp: 48 },
  'boss.silent_crown': { type: 'special.decoy', count: 3, qtp: 0 },
  'boss.gorger_titan': { type: 'enemy.raider', count: 3, qtp: 24 },
  'boss.shatterstorm': { type: 'enemy.skimmer', count: 8, qtp: 96 },
  'boss.marshal': { type: 'enemy.lancer', count: 4, qtp: 48 },
  'boss.black_conductor': { type: 'enemy.jammer', count: 2, qtp: 40 },
  'boss.root_below': { type: 'special.root', count: 3, qtp: 36 },
};
export function stageInfo(stage: number) {
  if (!Number.isInteger(stage) || stage < 0 || stage >= 40)
    throw new Error('Unknown campaign stage');
  const chapter = Math.floor(stage / 5),
    index = stage % 5;
  return {
    chapter,
    index,
    rank: CHAPTER_RANKS[chapter]! + index,
    name: `${CHAPTERS[chapter]} · ${['Introduction', 'Support Pressure', 'Divided Front', 'Counterplay', BOSSES[chapter]!.name][index]}`,
    code: `C${String(chapter + 1).padStart(2, '0')}S${String(index + 1).padStart(2, '0')}`,
    boss: index === 4 ? BOSSES[chapter]!.id : null,
  };
}
const factionWeights: Record<Faction, string[]> = {
  Fracture: ['runner', 'skimmer', 'carrier'],
  Iron: ['bulwark', 'lancer', 'bombard', 'breaker'],
  Hollow: ['veil', 'jammer', 'drainer'],
  Maw: ['mole', 'mender', 'harvester', 'carrier'],
};
export function availableRecipes(rank: number, band: number): string[] {
  const roles = ENEMIES.filter((d) => d.rank <= Math.min(rank, band * 5));
  return RECIPES.filter(
    (r) =>
      r === 'Balanced' ||
      (r === 'Armored' && roles.some((d) => armored.has(d.id))) ||
      (r === 'Air' && roles.some((d) => d.layer === 'air')) ||
      (r === 'Infiltration' && roles.some((d) => stealth.has(d.id))) ||
      (r === 'Support' && roles.some((d) => SUPPORT_ROLES.has(d.id))) ||
      (r === 'Alternating fronts' && band >= 3),
  );
}
export function price(tp: number, rank: 0 | 1 | 2 | 3): number {
  return tp * [4, 5, 8, 12][rank]!;
}
export async function planDigest(plan: Plan): Promise<string> {
  const { id: _id, hash: _hash, name: _name, ...identity } = plan;
  return hash({ ...identity, mode: plan.originMode ?? plan.mode, originMode: null });
}
export async function compile(input: CompileInput): Promise<Plan> {
  let requiredRank = input.rank,
    duration: Plan['duration'] = 300,
    boss = input.boss ?? null,
    stage = input.mode === 'Campaign' ? (input.stage ?? 0) : null,
    trial = input.mode === 'Mastery' ? (input.trial ?? null) : null;
  let faction: Faction = 'Fracture',
    seed = input.seed,
    name = `${input.mode} · ${input.recipe ?? 'Balanced'}`;
  if (input.mode === 'Campaign') {
    const info = stageInfo(stage ?? 0);
    stage = stage ?? 0;
    requiredRank = info.rank;
    duration = stage === 0 ? 90 : ([120, 180, 240, 300, 420][info.index] as Plan['duration']);
    boss = info.boss;
    faction = FACTIONS[info.chapter % 4]!;
    seed = `RB-Campaign-v1-${info.code}`;
    name = `${info.code} · ${info.name}`;
  }
  if (input.mode === 'Mastery' && trial !== null) {
    if (trial < 0 || trial >= 12) throw new Error('Unknown mastery trial');
    requiredRank = 95;
    boss = trial < 8 ? BOSSES[trial]!.id : null;
    duration = boss ? 420 : 300;
    faction = FACTIONS[trial % 4]!;
    seed = `RB-Mastery-v1-MT${trial + 1}`;
    name = `MT${String(trial + 1).padStart(2, '0')} · ${boss ? definition(boss).name : ['Sky dominance', 'Iron breach', 'Hollow infiltration', 'Maw support'][trial - 8]}`;
  }
  if (boss && ['Boss Siege', 'Mastery', 'Long Watch', 'Calibration'].includes(input.mode))
    duration = 420;
  const block = input.block ?? 1,
    blocks = input.mode === 'Endurance' ? Math.max(1, Math.min(6, input.blocks ?? 3)) : 1;
  if (input.mode === 'Endurance') {
    duration = 300;
    if (block === 3 || block === 6)
      boss = input.boss ?? BOSSES.filter((d) => d.rank <= requiredRank).at(-1)?.id ?? null;
    else boss = null;
  }
  const band =
    input.mode === 'Campaign'
      ? Math.floor((requiredRank - 1) / 5) + 1
      : input.mode === 'Mastery'
        ? trial === null
          ? 20
          : 19
        : (input.band ?? Math.floor((requiredRank - 1) / 5) + 1);
  if (
    band < 1 ||
    band > 20 ||
    !Number.isInteger(band) ||
    requiredRank < 1 ||
    requiredRank > 100 ||
    block > blocks
  )
    throw new Error('Encounter rank/band/block outside limits');
  if (!['Campaign', 'Mastery', 'Calibration'].includes(input.mode))
    requiredRank = Math.min(requiredRank, band * 5);
  if (
    (input.difficulty === 'Master' && input.rank < 75) ||
    (input.difficulty === 'Cataclysm' && input.rank < 90)
  )
    throw new Error('Difficulty is rank locked');
  const modifiers = [...new Set(input.modifiers ?? [])];
  if (modifiers.length > 2 || (modifiers.length && input.rank < 100))
    throw new Error('Choose at most two Rank 100 modifiers');
  const tier = input.tier ?? 0;
  if (
    !Number.isInteger(tier) ||
    tier < 0 ||
    tier > 8 ||
    (tier &&
      !(input.rank === 100 && ['Mastery', 'Long Watch'].includes(input.mode) && trial === null))
  )
    throw new Error('Challenge tiers require Rank 100 generated Mastery or Long Watch');
  const fs = await RandomStream.seeded(seed, 'faction', FULL_VERSION);
  if (!['Campaign', 'Mastery'].includes(input.mode) || (input.mode === 'Mastery' && trial === null))
    faction = FACTIONS[fs.next() % 4]!;
  if (boss) faction = FACTIONS[BOSSES.findIndex((d) => d.id === boss) % 4] ?? faction;
  const secondaryFaction =
    stage === null && requiredRank >= 35 && input.secondary !== false
      ? FACTIONS.filter((f) => f !== faction)[fs.next() % 3]!
      : null;
  const count = Math.ceil(duration / 20),
    base = resamplePressure(
      input.mode === 'Campaign' ? count : 15,
      input.mode === 'Campaign' ? 'original' : (input.pressure ?? 'original'),
    );
  const pressureFractions = Array.from({ length: count }, (_, i) => ({
      n: Number(base[i % base.length]!.n),
      d: Number(base[i % base.length]!.d),
    })),
    pressure = pressureFractions.map((p) => (p.n * 100) / p.d);
  let recipe = input.recipe ?? 'Balanced';
  if (trial !== null && trial >= 8)
    recipe = ['Air', 'Armored', 'Infiltration', 'Support'][trial - 8]!;
  if (stage !== null && stage % 5 === 3)
    recipe = ENEMIES.some((d) => d.rank <= requiredRank && d.layer === 'air')
      ? 'Air'
      : ENEMIES.some((d) => d.rank <= requiredRank && stealth.has(d.id))
        ? 'Infiltration'
        : 'Balanced';
  if (
    stage === null &&
    !input.calibration &&
    !availableRecipes(requiredRank, band).includes(recipe)
  )
    throw new Error(`${recipe} recipe is unavailable at this declared band`);
  const plan: Plan = {
    version: FULL_VERSION,
    id: crypto.randomUUID(),
    seed,
    mode: input.mode,
    originMode: null,
    following: [],
    mastery: input.mode === 'Mastery' || !!input.mastery,
    practice: null,
    name,
    requiredRank,
    band,
    difficulty: input.difficulty,
    modifiers,
    tier,
    faction,
    secondaryFaction,
    duration,
    block,
    blocks,
    stage,
    trial,
    boss,
    recipe,
    pressure,
    pressureFractions,
    spawns: [],
    hash: '',
    objectives: ['warden_survives', 'core_75'],
    attempt: 0,
    budgetQTP: [],
    discardedQTP: 0,
  };
  if ((stage !== null && stage % 5 === 3) || (trial !== null && trial >= 8))
    plan.objectives = ['no_wrecks', 'core_75'];
  if (input.calibration) {
    const c = input.calibration,
      d = definition(c.type);
    if (
      d.category !== 'enemy' ||
      d.rank > input.rank ||
      !Number.isInteger(c.count) ||
      c.count < 1 ||
      c.count > 30 ||
      c.entrance < 0 ||
      c.entrance > 5 ||
      c.variant > (band >= 14 ? 3 : band >= 6 ? 2 : band >= 3 ? 1 : 0)
    )
      throw new Error('Calibration selection unavailable');
    plan.duration = 90;
    plan.boss = null;
    plan.spawns = Array.from({ length: c.count }, (_, i) => ({
      tick: 180 + i * 15,
      type: c.type,
      rank: c.variant,
      entrance: c.entrance,
      segment: 1,
      qtp: price(d.threat, c.variant),
      children: d.id === 'enemy.carrier' ? 4 : 0,
      faction,
      packet: i,
    }));
  } else if (stage === 0) {
    const runner = [10, 13, 16, 19, 22, 25, 50, 53, 56, 59, 62, 65, 75, 77, 79, 81, 83, 85],
      raider = [30, 35, 40, 70, 74, 78];
    plan.spawns = [
      ...runner.map((s) => ({
        tick: s * 60,
        type: 'enemy.runner',
        rank: 0 as const,
        entrance: 0,
        segment: Math.min(5, Math.floor(s / 20) + 1),
        qtp: 4,
        children: 0,
        faction,
        packet: 0,
      })),
      ...raider.map((s) => ({
        tick: s * 60,
        type: 'enemy.raider',
        rank: 0 as const,
        entrance: 0,
        segment: Math.min(5, Math.floor(s / 20) + 1),
        qtp: 8,
        children: 0,
        faction,
        packet: 0,
      })),
    ].sort((a, b) => a.tick - b.tick || compareIDs(a.type, b.type));
    plan.spawns.forEach((s, i) => {
      s.packet = i;
    });
    plan.budgetQTP = [120];
  } else {
    const budgets = pressureFractions.map(
      (p) =>
        Number(
          (BigInt(20 + 4 * (band - 1)) *
            BigInt(Math.round(DIFFICULTY_THREAT[input.difficulty] * 100)) *
            BigInt(55 * p.d + 90 * p.n) *
            BigInt(100 + 8 * (input.mode === 'Endurance' ? block - 1 : 0)) *
            BigInt(modifiers.includes('crossfire') ? 110 : 100) *
            BigInt(100 + 20 * tier)) /
            (100n * 100n * BigInt(p.d) * 100n * 100n * 100n),
        ) * 4,
    );
    plan.budgetQTP = [...budgets];
    if (boss) {
      const d = definition(boss);
      if (d.category !== 'boss' || (d.rank > requiredRank && input.mode !== 'Mastery'))
        throw new Error('Boss is not unlocked at this declared band');
      let cost = d.threat * 4 + (bossReserve[boss]?.qtp ?? 0);
      for (let i = 7; i <= 11 && cost; i++) {
        const take = Math.min(budgets[i] ?? 0, cost);
        budgets[i] = (budgets[i] ?? 0) - take;
        cost -= take;
      }
      if (cost) throw new Error('Boss and finite summons exceed the encounter budget');
    }
    let accepted = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      plan.attempt = attempt;
      let packed: Awaited<ReturnType<typeof pack>>;
      try {
        packed = await pack(plan, budgets, attempt);
      } catch {
        continue;
      }
      plan.spawns = packed.spawns;
      plan.discardedQTP = packed.discarded;
      if (boss)
        plan.spawns.push({
          tick: 10800,
          type: boss,
          rank: 0,
          entrance: packed.bossEntrance,
          segment: 10,
          qtp: definition(boss).threat * 4 + (bossReserve[boss]?.qtp ?? 0),
          children: bossReserve[boss]?.count ?? 0,
          faction,
          packet: 10000,
        });
      plan.spawns.sort(
        (a, b) => a.tick - b.tick || a.packet - b.packet || compareIDs(a.type, b.type),
      );
      try {
        validatePlan(plan);
        validateComposition(plan);
        accepted = true;
        break;
      } catch {
        /* Whole candidate is discarded; no hidden adjustment of actor stats. */
      }
    }
    if (!accepted)
      throw new Error(
        'This recipe could not satisfy its composition and packet limits in ten deterministic attempts. Choose another seed, recipe, or band.',
      );
  }
  validatePlan(plan);
  if (input.mode === 'Endurance' && block === 1 && blocks > 1)
    for (let next = 2; next <= blocks; next++)
      plan.following.push(await compile({ ...input, block: next, blocks }));
  plan.hash = await planDigest(plan);
  plan.id = `${plan.hash.slice(0, 8)}-${plan.hash.slice(8, 12)}-5${plan.hash.slice(13, 16)}-8${plan.hash.slice(17, 20)}-${plan.hash.slice(20, 32)}`;
  return plan;
}
interface Candidate {
  type: string;
  rank: 0 | 1 | 2 | 3;
  faction: Faction;
  qtp: number;
  weight: number;
}
async function pack(p: Plan, budgets: number[], attempt: number) {
  const streams = await Promise.all(
    ['composition', 'rank', 'entrance', 'pressure', 'placement', 'accuracy'].map((s) =>
      RandomStream.seeded(`${p.seed}|${p.block}|${attempt}`, s, FULL_VERSION),
    ),
  );
  const composition = streams[0]!,
    entrance = streams[2]!;
  const roles = ENEMIES.filter((d) => d.rank <= p.requiredRank).sort((a, b) =>
    compareIDs(a.id, b.id),
  );
  const variants = ([0, 1, 2, 3] as const).filter(
    (v) =>
      v === 0 || (v === 1 && p.band >= 3) || (v === 2 && p.band >= 6) || (v === 3 && p.band >= 14),
  );
  const emphasized = (id: string) =>
    p.recipe === 'Armored'
      ? armored.has(id)
      : p.recipe === 'Air'
        ? definition(id).layer === 'air'
        : p.recipe === 'Infiltration'
          ? stealth.has(id)
          : p.recipe === 'Support'
            ? SUPPORT_ROLES.has(id)
            : false;
  const intro =
      p.stage !== null && p.stage % 5 === 0
        ? roles.slice().sort((a, b) => b.rank - a.rank || compareIDs(a.id, b.id))[0]?.id
        : null,
    supportStage =
      p.stage !== null && p.stage % 5 === 1 && roles.some((d) => SUPPORT_ROLES.has(d.id));
  const candidates: Candidate[] = roles.flatMap((d) =>
    variants.flatMap((rank) =>
      (p.secondaryFaction ? [p.faction, p.secondaryFaction] : [p.faction]).map((faction) => ({
        type: d.id,
        rank,
        faction,
        qtp: price(d.threat, rank),
        weight:
          (factionWeights[faction].includes(d.id.slice(6)) ? 15 : 10) *
          (emphasized(d.id) ? 3 : 1) *
          [70, 20, 8, 2][rank]! *
          (faction === p.faction ? 70 : 30) *
          (p.modifiers.includes('support') && SUPPORT_ROLES.has(d.id) ? 3 : 2),
      })),
    ),
  );
  let spent = 0,
    support = 0,
    air = 0,
    hidden = 0,
    elite = 0,
    secondary = 0,
    specialists = 0,
    ordinaryCount = 0,
    emphasis = 0,
    introduced = 0,
    carry = 0,
    discarded = 0,
    packetID = 0;
  const spawns: Spawn[] = [],
    seen = new Set<string>();
  const perm = [0, 1, 2, 3, 4, 5];
  for (let i = 5; i > 0; i--) {
    const j = entrance.next() % (i + 1);
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  let fronts = Math.min(
    6,
    (p.band <= 2
      ? 1
      : p.band <= 5
        ? 2
        : p.band <= 9
          ? 3
          : p.band <= 13
            ? 4
            : p.band <= 17
              ? 5
              : 6) + (p.modifiers.includes('crossfire') ? 1 : 0),
  );
  if (p.stage !== null && p.stage % 5 === 2) fronts = Math.min(2, fronts);
  let frontCursor = entrance.next() % fronts;
  for (let segment = 0; segment < budgets.length; segment++) {
    let remaining = budgets[segment]! + carry;
    const selected: Candidate[] = [],
      counts = new Map<string, number>();
    let packets = 0;
    const key = (c: Candidate) => `${c.type}|${c.rank}|${c.faction}`;
    for (let draw = 0; draw < 2048 && remaining >= 4; draw++) {
      let eligible = candidates.filter((c) => {
        const total = spent + c.qtp,
          n = ordinaryCount + 1,
          d = definition(c.type),
          count = counts.get(key(c)) ?? 0;
        return (
          c.qtp <= remaining &&
          (count % 6 > 0 || packets < 49) &&
          (!SUPPORT_ROLES.has(c.type) || (support + c.qtp) * 4 <= total) &&
          (d.layer !== 'air' || (air + c.qtp) * 10 <= total * 3) &&
          (!stealth.has(c.type) ||
            (hidden + c.qtp) * 100 <=
              total * (p.band < 10 || p.recipe === 'Infiltration' ? 20 : 100)) &&
          (c.rank < 2 ||
            (elite + c.qtp) * 100 <= total * (p.modifiers.includes('elite') ? 40 : 30)) &&
          (c.faction === p.faction || (secondary + c.qtp) * 10 <= total * 3) &&
          (!SPECIALIST_ROLES.has(c.type) || (specialists + 1) * 100 <= n * 35) &&
          (p.recipe !== 'Armored' || !armored.has(c.type) || (emphasis + c.qtp) * 10 <= total * 4)
        );
      });
      if (!eligible.length) break;
      const missing = eligible.filter((c) => !seen.has(c.type));
      if (seen.size < Math.min(3, roles.length) && missing.length) eligible = missing;
      else if (intro && introduced * 10 < spent) {
        const match = eligible.filter((c) => c.type === intro);
        if (match.length) eligible = match;
      } else if (supportStage && support * 10 < spent) {
        const match = eligible.filter((c) => SUPPORT_ROLES.has(c.type));
        if (match.length) eligible = match;
      } else if (
        ['Armored', 'Air', 'Infiltration', 'Support'].includes(p.recipe) &&
        emphasis * 100 <
          spent *
            { Armored: 34, Air: 24, Infiltration: 17, Support: 22 }[
              p.recipe as 'Armored' | 'Air' | 'Infiltration' | 'Support'
            ]
      ) {
        const match = eligible.filter((c) => emphasized(c.type));
        if (match.length) eligible = match;
      }
      let roll = Number(
          (BigInt(composition.next()) * BigInt(eligible.reduce((sum, c) => sum + c.weight, 0))) /
            (1n << 32n),
        ),
        chosen = eligible[0]!;
      for (const c of eligible) {
        roll -= c.weight;
        if (roll < 0) {
          chosen = c;
          break;
        }
      }
      const d = definition(chosen.type),
        k = key(chosen),
        count = counts.get(k) ?? 0;
      if (count % 6 === 0) packets++;
      counts.set(k, count + 1);
      selected.push(chosen);
      remaining -= chosen.qtp;
      spent += chosen.qtp;
      ordinaryCount++;
      seen.add(chosen.type);
      if (SUPPORT_ROLES.has(chosen.type)) support += chosen.qtp;
      if (d.layer === 'air') air += chosen.qtp;
      if (stealth.has(chosen.type)) hidden += chosen.qtp;
      if (chosen.rank >= 2) elite += chosen.qtp;
      if (chosen.faction !== p.faction) secondary += chosen.qtp;
      if (SPECIALIST_ROLES.has(chosen.type)) specialists++;
      if (emphasized(chosen.type)) emphasis += chosen.qtp;
      if (chosen.type === intro) introduced += chosen.qtp;
    }
    const groups: Candidate[][] = [];
    for (const k of [...counts.keys()].sort()) {
      const all = selected.filter((c) => key(c) === k);
      for (let i = 0; i < all.length; i += 6) groups.push(all.slice(i, i + 6));
    }
    const high = (g: Candidate[]) =>
      g[0]!.rank >= 2 &&
      g.reduce((sum, c) => sum + c.qtp, 0) * 10 > (budgets[segment]! + carry) * 4;
    groups.sort((a, b) => Number(high(a)) - Number(high(b)) || compareIDs(key(a[0]!), key(b[0]!)));
    let previous = -15;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!,
        tick = Math.max(
          previous + 15,
          Math.round((i * 720) / Math.max(1, groups.length - 1)),
          high(group) ? 480 : 0,
        );
      if (tick > 720) throw new Error('Packet spacing exceeds the segment window');
      previous = tick;
      const front = perm[frontCursor++ % fronts]!,
        packet = packetID++;
      for (const c of group)
        spawns.push({
          tick: segment * 1200 + tick,
          type: c.type,
          rank: c.rank,
          entrance: front,
          segment: segment + 1,
          qtp: c.qtp,
          children: c.type === 'enemy.carrier' ? 4 : 0,
          faction: c.faction,
          packet,
        });
    }
    if (p.recipe === 'Alternating fronts') frontCursor++;
    carry = Math.min(remaining, Math.floor((budgets[segment + 1] ?? 0) / 2));
    discarded += remaining - carry;
  }
  return { spawns, discarded, bossEntrance: perm[0]! };
}
export function validatePlan(p: Plan): void {
  if (
    p.version !== FULL_VERSION ||
    p.spawns.length > 4096 ||
    p.spawns.some(
      (s) =>
        !Number.isInteger(s.tick) ||
        s.tick < 0 ||
        s.entrance < 0 ||
        s.entrance > 5 ||
        s.children + 1 > 120 ||
        s.qtp < 0 ||
        (s.type.startsWith('boss.') && s.tick < 5400) ||
        !definition(s.type),
    )
  )
    throw new Error('Encounter plan failed finite bounds validation');
  let previous = -1;
  for (const s of p.spawns) {
    if (s.tick < previous) throw new Error('Encounter schedule out of order');
    previous = s.tick;
  }
  if (p.spawns.filter((s) => s.type.startsWith('boss.')).length > 1)
    throw new Error('Only one boss per encounter');
  if (
    p.following.some(
      (child) =>
        child.following.length ||
        child.mode !== 'Endurance' ||
        child.block < 2 ||
        child.blocks !== p.blocks,
    ) ||
    (p.following.length && p.following.length !== p.blocks - 1)
  )
    throw new Error('Invalid bounded Endurance continuations');
  const packets = new Map<number, Spawn[]>();
  for (const s of p.spawns) {
    const g = packets.get(s.packet) ?? [];
    g.push(s);
    packets.set(s.packet, g);
  }
  for (const group of packets.values())
    if (
      group.length > 6 ||
      group.some(
        (s) =>
          s.tick !== group[0]!.tick ||
          s.type !== group[0]!.type ||
          s.rank !== group[0]!.rank ||
          s.faction !== group[0]!.faction ||
          s.entrance !== group[0]!.entrance,
      ) ||
      group.reduce((n, s) => n + 1 + s.children, 0) > 120
    )
      throw new Error('Invalid atomic packet');
  if (p.stage !== 0 && p.spawns.some((s) => s.tick > p.duration * 60 - 480))
    throw new Error('Final deployment violates cleanup lead');
}
export function validateComposition(p: Plan): void {
  const ordinary = p.spawns.filter((s) => s.type.startsWith('enemy.'));
  const total = ordinary.reduce((n, s) => n + s.qtp, 0),
    count = ordinary.length,
    share = (filter: (s: Spawn) => boolean) =>
      ordinary.filter(filter).reduce((n, s) => n + s.qtp, 0);
  if (!total) throw new Error('Empty ordinary encounter');
  if (
    share((s) => SUPPORT_ROLES.has(s.type)) * 4 > total ||
    share((s) => definition(s.type).layer === 'air') * 10 > total * 3 ||
    (p.band < 10 && share((s) => stealth.has(s.type)) * 5 > total) ||
    share((s) => s.rank >= 2) * 100 > total * (p.modifiers.includes('elite') ? 40 : 30) ||
    share((s) => s.faction !== p.faction) * 10 > total * 3 ||
    ordinary.filter((s) => SPECIALIST_ROLES.has(s.type)).length * 100 > count * 35
  )
    throw new Error('Composition exceeds a global cap');
  if (
    new Set(ordinary.map((s) => s.type)).size <
    Math.min(3, ENEMIES.filter((d) => d.rank <= p.requiredRank).length)
  )
    throw new Error('Missing ordinary role variety');
  const ranges: Record<string, [number, number, (s: Spawn) => boolean]> = {
    Armored: [30, 40, (s) => armored.has(s.type)],
    Air: [20, 30, (s) => definition(s.type).layer === 'air'],
    Infiltration: [15, 20, (s) => stealth.has(s.type)],
    Support: [20, 25, (s) => SUPPORT_ROLES.has(s.type)],
  };
  const range = ranges[p.recipe];
  if (range) {
    const value = share(range[2]);
    if (value * 100 < total * range[0] || value * 100 > total * range[1])
      throw new Error('Recipe composition outside its published range');
  }
  if (p.stage !== null && p.stage % 5 === 0) {
    const newest = ENEMIES.filter((d) => d.rank <= p.requiredRank).sort(
      (a, b) => b.rank - a.rank || compareIDs(a.id, b.id),
    )[0]!;
    if (share((s) => s.type === newest.id) * 10 < total)
      throw new Error('Introduction role below ten percent');
  }
  if (
    p.stage !== null &&
    p.stage % 5 === 1 &&
    ENEMIES.some((d) => d.rank <= p.requiredRank && SUPPORT_ROLES.has(d.id)) &&
    share((s) => SUPPORT_ROLES.has(s.type)) * 10 < total
  )
    throw new Error('Support Pressure below ten percent');
}
