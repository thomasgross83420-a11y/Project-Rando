import { compile, availableRecipes } from './director';
import { BOSSES } from './catalog';
import {
  FULL_VERSION,
  type GameState,
  type Plan,
  type WatchSeries,
  type Difficulty,
  type Modifier,
} from './model';
import { hash } from '../sim/determinism';
import { parseBackupJSON } from '../persistence/json';
import { planSchema } from './validation';
import { planDigest, validatePlan, validateComposition } from './director';
export function series(
  s: GameState,
  band: number,
  difficulty: Difficulty,
  modifiers: Modifier[],
  tier: number,
  mastery = false,
): WatchSeries {
  if (s.rank < 30) throw new Error('Long Watch unlocks at Rank 30');
  return {
    id: crypto.randomUUID(),
    rootSeed: crypto.randomUUID(),
    band,
    difficulty,
    modifiers: [...modifiers],
    tier,
    mastery: mastery && s.stages.length === 40,
    parked: false,
    rerolls: 0,
    offers: [],
    sorties: 0,
    cleared: 0,
    streak: 0,
    best: 0,
    lastBoss: null,
    recent: [],
  };
}
export async function offers(s: GameState): Promise<void> {
  const w = s.watch;
  if (!w) throw new Error('Create a Long Watch series first');
  if (w.offers.length) return;
  const rank = Math.min(s.rank, w.band * 5),
    eligible = BOSSES.filter((d) => d.rank <= rank),
    bossSortie = BigInt(s.watchOrdinal) % 3n === 0n;
  const choices = eligible.filter((d) => d.id !== w.lastBoss || eligible.length === 1);
  const boss =
    bossSortie && choices.length
      ? choices[Number((BigInt(s.watchOrdinal) / 3n + BigInt(w.rerolls)) % BigInt(choices.length))]!
          .id
      : null;
  const legal = availableRecipes(rank, w.band),
    previous = w.recent.at(-1)?.split('|')[0],
    ordered = [...legal.filter((r) => r !== previous), ...legal.filter((r) => r === previous)];
  let omitBoss = false;
  const result: Plan[] = [];
  for (let index = 0; index < 3; index++) {
    let plan: Plan | null = null;
    for (let attempt = 0; attempt < 10 && !plan; attempt++) {
      const seed = `RB-Watch-v1|${w.rootSeed}|${s.watchEpoch}|${s.watchOrdinal}|${w.rerolls}|${index}|${attempt}`;
      const input = {
        mode: 'Long Watch' as const,
        seed,
        rank: s.rank,
        band: w.band,
        difficulty: w.difficulty,
        modifiers: w.modifiers,
        tier: w.tier,
        mastery: w.mastery,
        recipe: ordered[(index + attempt) % ordered.length]!,
      };
      try {
        plan = await compile({ ...input, boss: omitBoss ? null : boss });
        const fingerprint = `${plan.recipe}|${plan.boss ?? ''}|${plan.faction}|${plan.spawns
          .slice(0, 12)
          .map((s) => s.type)
          .join(',')}`;
        if (w.recent.includes(fingerprint) && attempt < 9) plan = null;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Boss and finite summons exceed the encounter budget'
        ) {
          omitBoss = true;
          try {
            plan = await compile(input);
            plan.name += ' · boss budget unavailable';
          } catch {
            /* Retry legal accompanying recipe. */
          }
        }
      }
    }
    if (!plan)
      throw new Error(
        'No legal Long Watch offer could be compiled. Lower the tier or choose another band.',
      );
    result.push(plan);
  }
  if (omitBoss && result.some((p) => p.boss)) {
    for (let i = 0; i < result.length; i++) {
      const p: Plan = result[i]!;
      result[i] = await compile({
        mode: 'Long Watch',
        seed: p.seed,
        rank: s.rank,
        band: w.band,
        difficulty: w.difficulty,
        modifiers: w.modifiers,
        tier: w.tier,
        mastery: w.mastery,
        recipe: p.recipe,
      });
      result[i]!.name += ' · boss budget unavailable';
    }
  }
  w.offers = result;
}
export function closeSeries(s: GameState) {
  if (!s.watch) return;
  const w = s.watch;
  s.closedWatches = [
    { name: `Watch ${w.id.slice(0, 8)}`, sorties: w.sorties, cleared: w.cleared, best: w.best },
    ...s.closedWatches,
  ].slice(0, 20);
  s.watch = null;
}
export async function encounterCode(plan: GameState['archive'][number]) {
  return JSON.stringify({
    format: 'RB-encounter-code',
    version: FULL_VERSION,
    plan,
    checksum: await hash(plan),
  });
}
export async function readEncounterCode(text: string, s: GameState) {
  const value = parseBackupJSON(text) as {
    format?: unknown;
    version?: unknown;
    plan?: unknown;
    checksum?: unknown;
  };
  if (value.format !== 'RB-encounter-code' || value.version !== FULL_VERSION)
    throw new Error('This encounter code uses an unsupported content version');
  const p = planSchema.parse(value.plan);
  if (value.checksum !== (await hash(p)) || p.hash !== (await planDigest(p)))
    throw new Error('Encounter code checksum failed');
  validatePlan(p);
  if (p.stage !== 0 && p.mode !== 'Calibration') validateComposition(p);
  if (
    p.requiredRank > s.rank ||
    p.spawns.some((v) => !v.type.startsWith('boss.') && v.type.startsWith('enemy.') && v.rank > 3)
  )
    throw new Error('Encounter exceeds this campaign’s unlocks');
  return {
    ...p,
    mode: p.mode === 'Calibration' ? ('Calibration' as const) : ('Archive' as const),
    originMode: p.originMode ?? p.mode,
  };
}
