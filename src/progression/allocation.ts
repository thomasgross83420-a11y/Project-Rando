import thresholds from '../data/progression.json';
import { add, floor, multiply, rational, type Rational } from '../economy/policy';
export const ASSET_XP_CAP = thresholds.assetCumulative[99] as number;
const LIFETIME_CAP = (1n << 128n) - 1n;
const bounded = (value: number, lo: number, hi: number) => {
  if (!Number.isSafeInteger(value) || value < lo || value > hi)
    throw new Error('Progression integer out of range');
};
export function assetLevel(xp: number): number {
  bounded(xp, 0, ASSET_XP_CAP);
  let level = 1;
  for (let i = 1; i < thresholds.assetCumulative.length; i++) {
    const at = thresholds.assetCumulative[i];
    if (at === undefined || at > xp) break;
    level = i + 1;
  }
  return level;
}
export function applyRankXP(
  rank: number,
  progress: number,
  awarded: bigint,
  lifetime: bigint = 0n,
  alreadySaturated = false,
) {
  bounded(rank, 1, 100);
  bounded(progress, 0, Number.MAX_SAFE_INTEGER);
  if (awarded < 0n || lifetime < 0n || lifetime > LIFETIME_CAP)
    throw new Error('Progression counter domain');
  const next = thresholds.rankNext[rank - 1];
  if (rank === 100 ? progress !== 0 : next === undefined || progress >= next)
    throw new Error('Rank progress must be below its next threshold');
  const crossed: number[] = [];
  let rest = BigInt(progress) + awarded;
  while (rank < 100) {
    const cost = thresholds.rankNext[rank - 1];
    if (cost === undefined) throw new Error('Missing rank threshold');
    if (rest < BigInt(cost)) break;
    rest -= BigInt(cost);
    crossed.push(++rank);
  }
  const excess = rank === 100 ? rest : 0n;
  const sum = lifetime + excess;
  return {
    rank,
    progress: rank === 100 ? 0 : Number(rest),
    crossed,
    lifetime: sum > LIFETIME_CAP ? LIFETIME_CAP : sum,
    saturated: alreadySaturated || sum > LIFETIME_CAP,
  };
}
export interface Participant {
  id: string;
  xp: number;
  level: number;
  developing: boolean;
  /** Number of blocks operational for at least one tick; zero means ineligible. */
  blocks: number;
  /** Actual eligible contribution in a common exact unit (e.g. 1/1024 body). */
  contribution: bigint;
}
/** Combine exact 70/30 entitlements BEFORE largest-remainder rounding. Capped
 * recipients are excluded before normalization; newly capped excess is unused.
 * Does not infer developing eligibility or fabricate a combat contribution.
 */
export function allocateAssetXP(pool: bigint, rank: number, input: readonly Participant[]) {
  if (pool < 0n) throw new Error('Negative asset XP pool');
  bounded(rank, 1, 100);
  if (input.length > 1024) throw new Error('Participant bound');
  const ids = new Set<string>();
  for (const p of input) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p.id) ||
      ids.has(p.id)
    )
      throw new Error('Participant identity invalid or duplicate');
    ids.add(p.id);
    bounded(p.blocks, 0, 6);
    if (p.level !== assetLevel(p.xp) || p.contribution < 0n)
      throw new Error('Participant XP/level/contribution mismatch');
  }
  const eligible = input.filter((p) => p.developing && p.blocks > 0 && p.level < 100);
  const weights = eligible.map((p) =>
    BigInt((25 + 2 * Math.max(0, Math.min(25, rank - p.level))) * p.blocks),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0n);
  const score = eligible.reduce((a, p) => a + p.contribution, 0n);
  const fractions: { p: Participant; share: Rational; allocated: bigint; remainder: Rational }[] =
    eligible.map((p, i) => {
      const weight = weights[i];
      if (weight === undefined) throw new Error('Missing participation weight');
      const participation = rational(weight, totalWeight);
      const contribution = score ? rational(p.contribution, score) : participation;
      const share = multiply(
        rational(pool),
        add(multiply(rational(7n, 10n), participation), multiply(rational(3n, 10n), contribution)),
      );
      const allocated = floor(share);
      return { p, share, allocated, remainder: rational(share.n % share.d, share.d) };
    });
  let remainder = pool - fractions.reduce((a, p) => a + p.allocated, 0n);
  const ordered = [...fractions].sort((a, b) => {
    const delta = a.remainder.n * b.remainder.d - b.remainder.n * a.remainder.d;
    return delta ? (delta > 0n ? -1 : 1) : a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0;
  });
  for (const p of ordered) {
    if (!remainder) break;
    p.allocated++;
    remainder--;
  }
  if (eligible.length && remainder !== 0n) throw new Error('Allocation conservation failed');
  const allocations = fractions
    .map(({ p, allocated }) => {
      const room = BigInt(ASSET_XP_CAP - p.xp);
      const granted = allocated > room ? room : allocated;
      const xp = p.xp + Number(granted);
      return {
        id: p.id,
        allocated,
        granted,
        unused: allocated - granted,
        xp,
        level: assetLevel(xp),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const granted = allocations.reduce((a, p) => a + p.granted, 0n);
  return { allocations, granted, unused: pool - granted };
}
/** Growth preserves wounds; zero ending body can never be resurrected by XP. */
export function levelUpBody(body: number, oldMax: number, newMax: number): number {
  bounded(oldMax, 1, Number.MAX_SAFE_INTEGER);
  bounded(newMax, oldMax, Number.MAX_SAFE_INTEGER);
  bounded(body, 0, oldMax);
  return body === 0 ? 0 : body + (newMax - oldMax);
}
